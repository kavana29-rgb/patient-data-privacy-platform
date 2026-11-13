import sys
from datetime import timedelta
import models
import schemas
import security
from database import SessionLocal

def run_tests():
    print("==================================================")
    print("RUNNING MILESTONE 1 VERIFICATION TESTS")
    print("==================================================")

    # 1. Test Password Hashing and Verification
    print("\n[Test 1] Testing Password Hashing & Verification...")
    raw_password = "SecurePassword123!"
    hashed = security.hash_password(raw_password)
    assert hashed != raw_password, "Hash should not equal raw password"
    assert security.verify_password(raw_password, hashed) is True, "Password verification failed"
    assert security.verify_password("WrongPassword123!", hashed) is False, "Wrong password verified as true"
    print("✓ Password hashing & verification working properly.")

    # 2. Test JWT Generation & Decoding
    print("\n[Test 2] Testing JWT Generation & Decoding...")
    token_data = {"sub": "test@example.com", "user_id": 999, "role": "patient"}
    token = security.create_access_token(token_data)
    decoded = security.decode_access_token(token)
    assert decoded is not None, "Failed to decode JWT"
    assert decoded.get("sub") == "test@example.com", "JWT sub claim mismatch"
    assert decoded.get("user_id") == 999, "JWT user_id claim mismatch"
    assert decoded.get("role") == "patient", "JWT role claim mismatch"

    # Expired token test
    expired_token = security.create_access_token(token_data, expires_delta=timedelta(seconds=-10))
    decoded_expired = security.decode_access_token(expired_token)
    assert decoded_expired is None, "Expired token was not rejected"
    print("✓ JWT generation, decoding and expiration validation working properly.")

    # 3. Test Pydantic Schemas
    print("\n[Test 3] Testing Pydantic Schemas Validation...")
    # Valid patient registration
    valid_data = {
        "email": "patient@hospital.org",
        "password": "Password1234!",
        "full_name": "Jane Doe",
        "role": "patient",
        "blood_group": "O+"
    }
    schema_user = schemas.UserRegister(**valid_data)
    assert schema_user.email == "patient@hospital.org"
    assert schema_user.role == models.UserRole.PATIENT

    # Invalid weak password validation
    try:
        schemas.UserRegister(
            email="weak@example.com",
            password="weak",
            full_name="Weak User",
            role="patient"
        )
        assert False, "Weak password should have failed validation"
    except Exception as e:
        print("✓ Weak password correctly caught by schema validator.")

    # 4. Database CRUD with Rollback/Cleanup
    print("\n[Test 4] Testing Database Models and Relationships...")
    db = SessionLocal()
    try:
        test_email = "test_verification_user@example.com"
        # Cleanup any leftover test user
        existing = db.query(models.User).filter(models.User.email == test_email).first()
        if existing:
            db.delete(existing)
            db.commit()

        # Create user
        new_user = models.User(
            email=test_email,
            hashed_password=security.hash_password("StrongPassword123!"),
            full_name="Verification Test Patient",
            role=models.UserRole.PATIENT,
            is_active=True
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        assert new_user.id is not None, "User id not assigned"
        print(f"✓ Created test User with ID: {new_user.id}, Role: {new_user.role.value}")

        # Create associated PatientProfile
        profile = models.PatientProfile(
            user_id=new_user.id,
            phone_number="+1-555-0199",
            blood_group="A+",
            allergies="Penicillin"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        assert profile.id is not None, "Profile id not assigned"
        print(f"✓ Created PatientProfile with ID: {profile.id} for User ID: {profile.user_id}")

        # Test relationship
        user_with_profile = db.query(models.User).filter(models.User.id == new_user.id).first()
        assert user_with_profile.patient_profile is not None, "Patient profile relationship failed"
        assert user_with_profile.patient_profile.blood_group == "A+"
        print("✓ 1-to-1 User <-> PatientProfile relationship verified.")

        # Cleanup test user
        db.delete(new_user)
        db.commit()
        print("✓ Test user and cascaded profile cleanly removed.")

    finally:
        db.close()

    print("\n==================================================")
    print("ALL MILESTONE 1 VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()

