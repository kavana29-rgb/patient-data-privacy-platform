from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import deps

router = APIRouter(prefix="/patient", tags=["Patient Profile"])


@router.get(
    "/profile",
    response_model=schemas.PatientProfileResponse,
    summary="Get authenticated patient's profile"
)
def get_patient_profile(
    current_user: models.User = Depends(deps.get_current_patient),
    db: Session = Depends(get_db)
):
    """
    Retrieves the patient profile for the currently authenticated patient:
    - Enforces that only users with the 'patient' role can access this endpoint.
    - Strictly restricts access to the authenticated user's own profile.
    """
    profile = current_user.patient_profile
    if not profile:
        # Edge case auto-recovery: create empty profile for patient
        profile = models.PatientProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return profile


@router.put(
    "/profile",
    response_model=schemas.PatientProfileResponse,
    summary="Update authenticated patient's profile"
)
def update_patient_profile(
    profile_in: schemas.PatientProfileUpdate,
    current_user: models.User = Depends(deps.get_current_patient),
    db: Session = Depends(get_db)
):
    """
    Updates the authenticated patient's profile:
    - Validates all incoming profile fields.
    - Updates user display name if supplied.
    - Restricts profile updates strictly to the authenticated patient's own record.
    """
    profile = current_user.patient_profile
    if not profile:
        profile = models.PatientProfile(user_id=current_user.id)
        db.add(profile)
        db.flush()

    # Update full_name on User model if provided
    if profile_in.full_name is not None and profile_in.full_name.strip():
        current_user.full_name = profile_in.full_name.strip()

    # Update patient profile fields
    update_data = profile_in.model_dump(exclude_unset=True, exclude={"full_name"})
    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile

