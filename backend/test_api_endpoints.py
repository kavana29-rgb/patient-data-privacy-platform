import sys
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from database import get_db, Base
import models
import schemas
import security

from sqlalchemy.pool import StaticPool

# -------------------------------------------------------------
# Setup isolated test database for reliable, clean integration tests
# -------------------------------------------------------------
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def run_api_tests():
    print("=" * 65)
    print("RUNNING MILESTONE 2: API ENDPOINT INTEGRATION TESTS")
    print("=" * 65)

    # ---------------------------------------------------------
    # 1. Healthcheck & Root
    # ---------------------------------------------------------
    print("\n[1/14] Testing Service Health Endpoints...")
    res = client.get("/health")
    assert res.status_code == 200, f"Healthcheck failed: {res.text}"
    assert res.json() == {"status": "healthy"}
    print("  ✓ GET /health returned 200 OK.")

    # ---------------------------------------------------------
    # 2. Patient Registration
    # ---------------------------------------------------------
    print("\n[2/14] Testing Patient Registration (POST /auth/register)...")
    patient_payload = {
        "email": "sarah.connor@privacycare.org",
        "password": "StrongPassword123!",
        "full_name": "Sarah Connor",
        "role": "patient",
        "date_of_birth": "1985-05-12",
        "gender": "Female",
        "phone_number": "+1-555-0100",
        "blood_group": "O+",
        "allergies": "None"
    }
    res = client.post("/auth/register", json=patient_payload)
    assert res.status_code == 201, f"Patient registration failed: {res.text}"
    patient_data = res.json()
    assert "access_token" in patient_data, "No access_token returned"
    assert patient_data["email"] == "sarah.connor@privacycare.org"
    assert patient_data["role"] == "patient"
    patient_token = patient_data["access_token"]
    print("  ✓ Patient registered successfully with linked profile and JWT.")

    # ---------------------------------------------------------
    # 3. Duplicate Email Prevention
    # ---------------------------------------------------------
    print("\n[3/14] Testing Duplicate Email Prevention (POST /auth/register)...")
    res = client.post("/auth/register", json=patient_payload)
    assert res.status_code == 400, f"Expected 400 for duplicate, got {res.status_code}"
    assert "already exists" in res.json()["detail"]
    print("  ✓ Duplicate email registration rejected with 400 Bad Request.")

    # ---------------------------------------------------------
    # 4. Provider Registration Without / Invalid Invite Code
    # ---------------------------------------------------------
    print("\n[4/14] Testing Provider Registration Restrictions...")
    # Missing invite code
    provider_no_code = {
        "email": "dr.rogers@hospital.org",
        "password": "DoctorPass123!",
        "full_name": "Dr. Steve Rogers",
        "role": "provider"
    }
    res = client.post("/auth/register", json=provider_no_code)
    assert res.status_code == 422 or res.status_code == 403, f"Expected rejection, got {res.status_code}"

    # Invalid invite code
    provider_bad_code = {
        "email": "dr.rogers@hospital.org",
        "password": "DoctorPass123!",
        "full_name": "Dr. Steve Rogers",
        "role": "provider",
        "provider_invite_code": "WRONG-CODE"
    }
    res = client.post("/auth/register", json=provider_bad_code)
    assert res.status_code == 403, f"Expected 403 for bad invite code, got {res.status_code}"
    print("  ✓ Unrestricted provider registration safely blocked with 403.")

    # ---------------------------------------------------------
    # 5. Provider Registration with Valid Invite Code
    # ---------------------------------------------------------
    print("\n[5/14] Testing Authorized Provider Registration...")
    provider_valid = {
        "email": "dr.rogers@hospital.org",
        "password": "DoctorPass123!",
        "full_name": "Dr. Steve Rogers",
        "role": "provider",
        "provider_invite_code": "MED-PROVIDER-2026"
    }
    res = client.post("/auth/register", json=provider_valid)
    assert res.status_code == 201, f"Provider registration failed: {res.text}"
    provider_data = res.json()
    assert provider_data["role"] == "provider"
    provider_token = provider_data["access_token"]
    print("  ✓ Provider registered successfully with approved invite code.")

    # ---------------------------------------------------------
    # 6. User Login with Correct Credentials
    # ---------------------------------------------------------
    print("\n[6/14] Testing User Login (POST /auth/login)...")
    login_payload = {
        "email": "sarah.connor@privacycare.org",
        "password": "StrongPassword123!"
    }
    res = client.post("/auth/login", json=login_payload)
    assert res.status_code == 200, f"Login failed: {res.text}"
    login_data = res.json()
    assert "access_token" in login_data
    assert login_data["email"] == "sarah.connor@privacycare.org"
    assert login_data["role"] == "patient"
    print("  ✓ User logged in successfully and received signed JWT.")

    # ---------------------------------------------------------
    # 7. Login with Wrong Password
    # ---------------------------------------------------------
    print("\n[7/14] Testing Login with Invalid Password...")
    bad_pass_payload = {
        "email": "sarah.connor@privacycare.org",
        "password": "WrongPassword999!"
    }
    res = client.post("/auth/login", json=bad_pass_payload)
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    assert "Invalid email or password" in res.json()["detail"]
    print("  ✓ Invalid password rejected with 401 Unauthorized.")

    # ---------------------------------------------------------
    # 8. Login with Non-Existent User
    # ---------------------------------------------------------
    print("\n[8/14] Testing Login with Non-Existent Email...")
    unknown_user = {
        "email": "nonexistent@privacycare.org",
        "password": "SomePassword123!"
    }
    res = client.post("/auth/login", json=unknown_user)
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("  ✓ Non-existent user rejected with 401 Unauthorized.")

    # ---------------------------------------------------------
    # 9. Get Current User Info (GET /auth/me) with Valid Token
    # ---------------------------------------------------------
    print("\n[9/14] Testing Current User Info (GET /auth/me)...")
    headers = {"Authorization": f"Bearer {patient_token}"}
    res = client.get("/auth/me", headers=headers)
    assert res.status_code == 200, f"GET /auth/me failed: {res.text}"
    me_data = res.json()
    assert me_data["email"] == "sarah.connor@privacycare.org"
    assert me_data["full_name"] == "Sarah Connor"
    assert "hashed_password" not in me_data, "SECURITY FLAW: hashed_password exposed in response"
    assert me_data["patient_profile"] is not None
    print("  ✓ GET /auth/me returned safe profile without credentials.")

    # ---------------------------------------------------------
    # 10. GET /auth/me Without Token
    # ---------------------------------------------------------
    print("\n[10/14] Testing Protected Route Without Token...")
    res = client.get("/auth/me")
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("  ✓ Unauthenticated access safely blocked with 401 Unauthorized.")

    # ---------------------------------------------------------
    # 11. Patient Profile Retrieval (GET /patient/profile)
    # ---------------------------------------------------------
    print("\n[11/14] Testing Patient Profile Retrieval (GET /patient/profile)...")
    res = client.get("/patient/profile", headers=headers)
    assert res.status_code == 200, f"GET /patient/profile failed: {res.text}"
    profile_data = res.json()
    assert profile_data["blood_group"] == "O+"
    assert profile_data["phone_number"] == "+1-555-0100"
    print("  ✓ Patient profile retrieved successfully.")

    # ---------------------------------------------------------
    # 12. Patient Profile Update (PUT /patient/profile)
    # ---------------------------------------------------------
    print("\n[12/14] Testing Patient Profile Update (PUT /patient/profile)...")
    update_payload = {
        "full_name": "Sarah J. Connor",
        "phone_number": "+1-555-9999",
        "address": "42 Cyberdyne Way, Los Angeles, CA",
        "emergency_contact_name": "John Connor",
        "emergency_contact_phone": "+1-555-8888",
        "blood_group": "O-",
        "allergies": "Penicillin, Sulfa",
        "medical_history": "Mild hypertension"
    }
    res = client.put("/patient/profile", json=update_payload, headers=headers)
    assert res.status_code == 200, f"PUT /patient/profile failed: {res.text}"
    updated_profile = res.json()
    assert updated_profile["blood_group"] == "O-"
    assert updated_profile["phone_number"] == "+1-555-9999"
    assert updated_profile["emergency_contact_name"] == "John Connor"

    # Verify updated full_name on /auth/me
    res_me = client.get("/auth/me", headers=headers)
    assert res_me.json()["full_name"] == "Sarah J. Connor"
    print("  ✓ Patient profile and name updated successfully.")

    # ---------------------------------------------------------
    # 13. Role-Based Access Enforcement on Patient Profile
    # ---------------------------------------------------------
    print("\n[13/14] Testing Role-Based Route Protection (Provider -> Patient Route)...")
    provider_headers = {"Authorization": f"Bearer {provider_token}"}
    res = client.get("/patient/profile", headers=provider_headers)
    assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"
    assert "patient" in res.json()["detail"].lower()
    print("  ✓ Provider role strictly forbidden (403) from accessing patient profile route.")

    # ---------------------------------------------------------
    # 14. Unauthenticated Patient Profile Access
    # ---------------------------------------------------------
    print("\n[14/14] Testing Unauthenticated Patient Profile Access...")
    res = client.get("/patient/profile")
    assert res.status_code == 401
    res = client.put("/patient/profile", json=update_payload)
    assert res.status_code == 401
    print("  ✓ Unauthenticated access strictly blocked with 401.")

    print("\n" + "=" * 65)
    print("ALL 14 API INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 65)


if __name__ == "__main__":
    run_api_tests()
