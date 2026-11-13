import sys
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import get_db, Base
import models

# In-memory clean database for deterministic end-to-end flow testing
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


def verify_frontend_backend_contracts():
    print("=" * 70)
    print("VERIFYING FRONTEND-BACKEND INTEGRATION CONTRACTS (MODULE A)")
    print("=" * 70)

    # 1. Frontend Register Flow: Patient
    print("\n[Contract 1] Frontend Patient Registration (POST /auth/register)...")
    patient_signup_data = {
        "role": "patient",
        "full_name": "Eleanor Vance",
        "email": "eleanor.vance@privacy-patient.org",
        "password": "SecurePassword2026!",
        "phone_number": "+1-555-0144",
        "date_of_birth": "1992-08-15",
        "gender": "Female",
        "blood_group": "AB+",
        "address": "100 Hill House Lane, Boston, MA"
    }
    res = client.post("/auth/register", json=patient_signup_data)
    assert res.status_code == 201, f"Registration failed: {res.text}"
    token_resp = res.json()
    assert "access_token" in token_resp
    assert token_resp["email"] == "eleanor.vance@privacy-patient.org"
    assert token_resp["role"] == "patient"
    patient_token = token_resp["access_token"]
    print("  ✓ Patient registered and token received matching frontend AuthContext expectations.")

    # 2. Frontend Register Flow: Duplicate Email Rejection
    print("\n[Contract 2] Frontend Duplicate Email Error Handling...")
    res_dup = client.post("/auth/register", json=patient_signup_data)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"]
    print("  ✓ Duplicate registration returns 400 with user-friendly error message.")

    # 3. Frontend Register Flow: Provider Protection
    print("\n[Contract 3] Frontend Healthcare Provider Invitation Check...")
    # Missing invite code
    provider_signup_bad = {
        "role": "provider",
        "full_name": "Dr. Montague",
        "email": "montague@hospital.org",
        "password": "DoctorSecure2026!"
    }
    res_bad_prov = client.post("/auth/register", json=provider_signup_bad)
    assert res_bad_prov.status_code in [403, 422]

    # Valid invite code
    provider_signup_good = {
        "role": "provider",
        "full_name": "Dr. John Montague",
        "email": "montague@hospital.org",
        "password": "DoctorSecure2026!",
        "provider_invite_code": "MED-PROVIDER-2026"
    }
    res_prov = client.post("/auth/register", json=provider_signup_good)
    assert res_prov.status_code == 201
    prov_data = res_prov.json()
    assert prov_data["role"] == "provider"
    provider_token = prov_data["access_token"]
    print("  ✓ Healthcare provider registration properly gated by administrative invite code.")

    # 4. Frontend Login Flow
    print("\n[Contract 4] Frontend Login Flow (POST /auth/login)...")
    login_success = client.post("/auth/login", json={
        "email": "eleanor.vance@privacy-patient.org",
        "password": "SecurePassword2026!"
    })
    assert login_success.status_code == 200
    assert "access_token" in login_success.json()

    login_fail = client.post("/auth/login", json={
        "email": "eleanor.vance@privacy-patient.org",
        "password": "WrongPassword!"
    })
    assert login_fail.status_code == 401
    assert "Invalid email or password" in login_fail.json()["detail"]
    print("  ✓ Login succeeds with valid credentials and fails safely with invalid password.")

    # 5. Frontend Session Sync (GET /auth/me)
    print("\n[Contract 5] Frontend Session Verification (GET /auth/me)...")
    headers = {"Authorization": f"Bearer {patient_token}"}
    res_me = client.get("/auth/me", headers=headers)
    assert res_me.status_code == 200
    me_json = res_me.json()
    assert me_json["email"] == "eleanor.vance@privacy-patient.org"
    assert me_json["patient_profile"]["blood_group"] == "AB+"
    assert "hashed_password" not in me_json
    print("  ✓ GET /auth/me returns safe profile matching frontend state requirements.")

    # 6. Frontend Profile Viewing & Updating (GET & PUT /patient/profile)
    print("\n[Contract 6] Patient Profile Retrieval & Updating...")
    res_profile = client.get("/patient/profile", headers=headers)
    assert res_profile.status_code == 200
    assert res_profile.json()["blood_group"] == "AB+"

    # Patient updates medical details
    update_data = {
        "full_name": "Eleanor Vance-Luke",
        "phone_number": "+1-555-9988",
        "allergies": "Amoxicillin, Pollen",
        "medical_history": "Asthma in childhood",
        "emergency_contact_name": "Theodora",
        "emergency_contact_phone": "+1-555-4321",
        "blood_group": "AB+"
    }
    res_update = client.put("/patient/profile", json=update_data, headers=headers)
    assert res_update.status_code == 200
    updated_json = res_update.json()
    assert updated_json["phone_number"] == "+1-555-9988"
    assert updated_json["allergies"] == "Amoxicillin, Pollen"
    assert updated_json["emergency_contact_name"] == "Theodora"

    # Confirm user model full_name also updated
    res_me_updated = client.get("/auth/me", headers=headers)
    assert res_me_updated.json()["full_name"] == "Eleanor Vance-Luke"
    print("  ✓ Patient successfully updated personal profile and emergency contacts.")

    # 7. Frontend Role-Based Protection: Clinician blocked from patient profile route
    print("\n[Contract 7] Role-Based Endpoint Protection Verification...")
    prov_headers = {"Authorization": f"Bearer {provider_token}"}
    res_forbidden = client.get("/patient/profile", headers=prov_headers)
    assert res_forbidden.status_code == 403
    print("  ✓ Backend strictly rejects unauthorized role access (403 Forbidden).")

    # 8. Post-Logout Protection: Blocked from protected routes without token
    print("\n[Contract 8] Post-Logout / Unauthenticated Protection...")
    res_unauth1 = client.get("/auth/me")
    assert res_unauth1.status_code == 401
    res_unauth2 = client.get("/patient/profile")
    assert res_unauth2.status_code == 401
    print("  ✓ Protected pages and APIs are completely inaccessible after logout (401).")

    print("\n" + "=" * 70)
    print("ALL FRONTEND-BACKEND INTEGRATION CONTRACTS VERIFIED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    verify_frontend_backend_contracts()

