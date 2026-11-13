import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import security
import deps

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Administrative/system invite code for healthcare providers
PROVIDER_INVITE_CODE = os.getenv("PROVIDER_INVITE_CODE", "MED-PROVIDER-2026")


@router.post(
    "/register",
    response_model=schemas.Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new patient or healthcare provider"
)
def register(
    user_in: schemas.UserRegister,
    db: Session = Depends(get_db)
):
    """
    Registers a new user (Patient or Healthcare Provider):
    - Validates email and enforces password complexity.
    - Rejects duplicate email addresses.
    - Restricts Healthcare Provider registration to valid invite/approval codes.
    - Securely hashes passwords with bcrypt before persistence.
    - Automatically creates a linked PatientProfile for patients.
    - Returns a signed JWT access token and user information.
    """
    # 1. Enforce provider invitation code check
    if user_in.role == models.UserRole.PROVIDER:
        if not user_in.provider_invite_code or user_in.provider_invite_code.strip() != PROVIDER_INVITE_CODE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing healthcare provider invitation/approval code."
            )

    # 2. Check for duplicate email
    existing_user = db.query(models.User).filter(
        models.User.email == user_in.email.lower().strip()
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # 3. Hash password securely
    hashed_password = security.hash_password(user_in.password)

    # 4. Create and persist user record
    new_user = models.User(
        email=user_in.email.lower().strip(),
        hashed_password=hashed_password,
        full_name=user_in.full_name.strip(),
        role=user_in.role,
        is_active=True
    )
    db.add(new_user)
    db.flush()  # Allocates new_user.id before committing

    # 5. Automatically create PatientProfile for patient registrations
    if user_in.role == models.UserRole.PATIENT:
        patient_profile = models.PatientProfile(
            user_id=new_user.id,
            date_of_birth=user_in.date_of_birth,
            gender=user_in.gender,
            phone_number=user_in.phone_number,
            address=user_in.address,
            emergency_contact_name=user_in.emergency_contact_name,
            emergency_contact_phone=user_in.emergency_contact_phone,
            blood_group=user_in.blood_group
        )
        db.add(patient_profile)

    db.commit()
    db.refresh(new_user)

    # 6. Generate JWT access token with role claim
    access_token = security.create_access_token({
        "sub": new_user.email,
        "user_id": new_user.id,
        "role": new_user.role.value
    })

    return schemas.Token(
        access_token=access_token,
        token_type="bearer",
        user_id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role.value
    )


@router.post(
    "/login",
    response_model=schemas.Token,
    summary="Authenticate user and return JWT access token"
)
def login(
    credentials: schemas.UserLogin,
    db: Session = Depends(get_db)
):
    """
    Authenticates a user with email and password:
    - Verifies bcrypt hashed password safely.
    - Rejects invalid credentials with a uniform 401 error.
    - Rejects inactive users with a 403 error.
    - Returns a signed JWT access token.
    """
    user = db.query(models.User).filter(
        models.User.email == credentials.email.lower().strip()
    ).first()

    if not user or not security.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is currently disabled. Please contact an administrator."
        )

    access_token = security.create_access_token({
        "sub": user.email,
        "user_id": user.id,
        "role": user.role.value
    })

    return schemas.Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value
    )


@router.get(
    "/me",
    response_model=schemas.UserResponse,
    summary="Retrieve current authenticated user's safe profile"
)
def get_me(
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Returns the currently authenticated user's safe details (excluding password hash)
    including their assigned role and linked patient profile if applicable.
    """
    return current_user
