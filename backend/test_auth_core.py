from datetime import timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
import models
import schemas
import security

def test_full_auth_core():
    print("=" * 60)
    print("RUNNING MILESTONE 1 VERIFICATION & VALIDATION SUITE")
    print("=" * 60)

    # -------------------------------------------------------------
    # 1. Test Password Security (bcrypt)
    # -------------------------------------------------------------
    print("\n[1/5] Testing Bcrypt Password Hashing & Verification...")
    raw_pass = "SecureDoc@2026!"
    hashed_pass = security.hash_password(raw_pass)
    assert hashed_pass != raw_pass, "Password was not hashed"
    assert security.verify_password(raw_pass, hashed_pass) is True, "Password verification failed"
    assert security.verify_password("WrongPassword123", hashed_pass) is False, "Invalid password falsely verified"
    assert security.verify_password("", hashed_pass) is False, "Empty password falsely verified"
    print("  ✓ Bcrypt password hashing and verification working securely.")

    # -------------------------------------------------------------
    # 2. Test JWT Token Lifecycle
    # -------------------------------------------------------------
    print("\n[2/5] Testing JWT Generation, Claims & Expiration...")
    token_claims = {
        "sub": "doctor@hospital.org",
        "user_id": 42,
        "role": "provider"
    }
    access_token = security.create_access_token(token_claims)
    decoded_claims = security.decode_access_token(access_token)
    assert decoded_claims is not None, "JWT failed to decode"
    assert decoded_claims["sub"] == "doctor@hospital.org"
    assert decoded_claims["user_id"] == 42
    assert decoded_claims["role"] == "provider"

    # Expired token rejection
    expired_token = security.create_access_token(token_claims, expires_delta=timedelta(seconds=-1))
    assert security.decode_access_token(expired_token) is None, "Expired JWT was not rejected"
    print("  ✓ JWT creation, signature decoding, and expiration enforcement verified.")

    # -------------------------------------------------------------
    # 3. Test Pydantic Schemas (Input Validation)
    # -------------------------------------------------------------
    print("\n[3/5] Testing Pydantic Registration and Login Schemas...")
    # Valid patient payload
    patient_in = schemas.UserRegister(
        email="patient.alex@domain.com",
        password="ValidPassword123!",
        full_name="Alex Smith",
        role=models.UserRole.PATIENT,
        phone_number="+1-555-1234",
        blood_group="O+"
    )
    assert patient_in.role == models.UserRole.PATIENT
    assert patient_in.blood_group == "O+"

    # Valid provider payload
    provider_in = schemas.UserRegister(
        email="dr.smith@clinic.org",
        password="StrongDoctorPass1#",
        full_name="Dr. Jane Smith",
        role=models.UserRole.PROVIDER
    )
    assert provider_in.role == models.UserRole.PROVIDER

    # Weak password rejection tests
    weak_passwords = ["short1!", "NoNumbers!", "nolowercase1!", "NOUPPERCASE1!"]
    for weak in weak_passwords:
        try:
            schemas.UserRegister(
                email="test@domain.com",
                password=weak,
                full_name="Test User",
                role=models.UserRole.PATIENT
            )
            assert False, f"Password '{weak}' should have failed strength validation"
        except ValueError:
            pass

    # Invalid email rejection
    try:
        schemas.UserRegister(
            email="not-an-email",
            password="ValidPassword123!",
            full_name="Test User",
            role=models.UserRole.PATIENT
        )
        assert False, "Invalid email format should have failed"
    except Exception:
        pass
    print("  ✓ User registration, role assignments, email and password validations verified.")

    # -------------------------------------------------------------
    # 4. Test SQLAlchemy Models & 1-to-1 Cascade Relationships
    # -------------------------------------------------------------
    print("\n[4/5] Testing SQLAlchemy Models & Cascade Relationships...")
    # Use clean test database engine
    engine = create_engine("sqlite:///:memory:")
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()

    # Create patient with profile
    patient_user = models.User(
        email="patient.cascade@example.com",
        hashed_password=security.hash_password("PatientPass123!"),
        full_name="Cascade Patient",
        role=models.UserRole.PATIENT
    )
    session.add(patient_user)
    session.commit()
    session.refresh(patient_user)

    profile = models.PatientProfile(
        user_id=patient_user.id,
        phone_number="+1-555-9876",
        blood_group="B-",
        allergies="Aspirin"
    )
    session.add(profile)
    session.commit()

    # Verify bidirectional relationship
    queried_user = session.query(models.User).filter(models.User.email == "patient.cascade@example.com").first()
    assert queried_user.patient_profile is not None
    assert queried_user.patient_profile.blood_group == "B-"
    assert queried_user.patient_profile.user.full_name == "Cascade Patient"

    # Verify cascade delete: deleting user deletes profile
    session.delete(queried_user)
    session.commit()
    orphan_profile = session.query(models.PatientProfile).filter(models.PatientProfile.user_id == patient_user.id).first()
    assert orphan_profile is None, "Profile was not cascade deleted with user"
    print("  ✓ SQLAlchemy User, PatientProfile, relationships and cascades verified.")

    # -------------------------------------------------------------
    # 5. Test Role-Based Dependencies Logic
    # -------------------------------------------------------------
    print("\n[5/5] Testing Role-Based Authorization Logic...")
    provider_user = models.User(
        id=101,
        email="doc@hospital.org",
        hashed_password="...",
        full_name="Dr. House",
        role=models.UserRole.PROVIDER,
        is_active=True
    )
    patient_user = models.User(
        id=102,
        email="patient@hospital.org",
        hashed_password="...",
        full_name="John Doe",
        role=models.UserRole.PATIENT,
        is_active=True
    )

    from deps import require_role
    provider_guard = require_role([models.UserRole.PROVIDER])
    patient_guard = require_role([models.UserRole.PATIENT])

    # Provider accessing provider endpoint
    assert provider_guard(provider_user) == provider_user
    # Patient accessing patient endpoint
    assert patient_guard(patient_user) == patient_user

    # Cross-access unauthorized rejection
    try:
        provider_guard(patient_user)
        assert False, "Patient should not access provider-only resource"
    except Exception as e:
        assert getattr(e, "status_code", None) == 403

    try:
        patient_guard(provider_user)
        assert False, "Provider should not access patient-only resource"
    except Exception as e:
        assert getattr(e, "status_code", None) == 403

    print("  ✓ Role-based access dependencies strictly enforce permissions.")

    session.close()
    print("\n" + "=" * 60)
    print("ALL MILESTONE 1 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_full_auth_core()
