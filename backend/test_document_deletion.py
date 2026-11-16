import os
import sys

os.environ["TESTING"] = "1"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import io

from main import app
from database import get_db, Base
import models
import security

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


def test_delete_flow():
    print("=" * 65)
    print("TESTING DOCUMENT DELETION & OWNERSHIP SAFETY")
    print("=" * 65)

    db = TestingSessionLocal()

    # 1. Create Patient 1 and Patient 2 and Provider
    p1 = models.User(
        email="patient1@mymeddata.org",
        hashed_password=security.hash_password("Patient1Pass!"),
        full_name="Patient One",
        role=models.UserRole.PATIENT,
        is_active=True
    )
    p2 = models.User(
        email="patient2@mymeddata.org",
        hashed_password=security.hash_password("Patient2Pass!"),
        full_name="Patient Two",
        role=models.UserRole.PATIENT,
        is_active=True
    )
    prov = models.User(
        email="doctor@mymeddata.org",
        hashed_password=security.hash_password("DoctorPass!"),
        full_name="Dr. Smith",
        role=models.UserRole.PROVIDER,
        is_active=True
    )
    db.add_all([p1, p2, prov])
    db.commit()
    db.refresh(p1)
    db.refresh(p2)
    db.refresh(prov)

    token_p1 = security.create_access_token({"sub": p1.email, "user_id": p1.id, "role": p1.role.value})
    token_p2 = security.create_access_token({"sub": p2.email, "user_id": p2.id, "role": p2.role.value})
    token_prov = security.create_access_token({"sub": prov.email, "user_id": prov.id, "role": prov.role.value})

    h_p1 = {"Authorization": f"Bearer {token_p1}"}
    h_p2 = {"Authorization": f"Bearer {token_p2}"}
    h_prov = {"Authorization": f"Bearer {token_prov}"}

    # 2. Patient 1 uploads a valid PDF
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Confidential Test) >>\nendobj\ntrailer\n<< >>\n%%EOF"
    upload_res = client.post(
        "/documents/upload",
        files={"file": ("Patient1_LabReport.pdf", io.BytesIO(pdf_content), "application/pdf")},
        headers=h_p1
    )
    assert upload_res.status_code == 201, f"Upload failed: {upload_res.text}"
    doc_id = upload_res.json()["id"]
    print(f"  ✓ Patient 1 uploaded document #{doc_id}.")

    # Verify physical file exists on disk
    doc_record = db.query(models.MedicalDocument).filter_by(id=doc_id).first()
    assert doc_record is not None
    assert os.path.exists(doc_record.original_file_path)
    file_on_disk = doc_record.original_file_path

    # 3. Provider requests access to document
    req_res = client.post(
        "/sharing/requests",
        json={"patient_id": p1.id, "document_id": doc_id, "purpose": "Cardiology consult"},
        headers=h_prov
    )
    assert req_res.status_code == 201
    print("  ✓ Provider requested access, creating foreign key linkage in provider_access_requests and access_audit_logs.")

    # 4. Patient 2 attempts to delete Patient 1's document -> must be rejected with 403 Forbidden
    unauthorized_del = client.delete(f"/documents/{doc_id}", headers=h_p2)
    assert unauthorized_del.status_code == 403, f"Expected 403, got {unauthorized_del.status_code}"
    print("  ✓ Cross-patient deletion strictly forbidden (403).")

    # 5. Patient 1 deletes their own document -> 200 OK
    delete_res = client.delete(f"/documents/{doc_id}", headers=h_p1)
    assert delete_res.status_code == 200, f"Delete failed: {delete_res.text}"
    assert "deleted successfully" in delete_res.json()["message"].lower()
    print("  ✓ Patient 1 successfully deleted document.")

    # 6. Verify physical file is gone from disk
    assert not os.path.exists(file_on_disk), "Physical file should have been deleted from disk!"
    print("  ✓ Physical file securely unlinked from disk.")

    # 7. Verify database record is deleted
    db.expire_all()
    assert db.query(models.MedicalDocument).filter_by(id=doc_id).first() is None
    print("  ✓ MedicalDocument database row removed.")

    # 8. Verify foreign key constraints handled cleanly
    # Provider request referencing this document was cleaned up
    assert db.query(models.ProviderAccessRequest).filter_by(document_id=doc_id).first() is None
    print("  ✓ Linked provider_access_requests rows safely removed.")

    # Audit log preserves history with nullified document_id
    audit = db.query(models.AccessAuditLog).filter_by(patient_id=p1.id).first()
    assert audit is not None
    assert audit.document_id is None, "Audit log document_id should be SET NULL to preserve audit trail!"
    print("  ✓ AccessAuditLog preserved with document_id set to NULL for regulatory compliance.")

    # 9. Verify subsequent GET or DELETE returns 404
    get_res = client.get(f"/documents/{doc_id}/file", headers=h_p1)
    assert get_res.status_code == 404
    del_again = client.delete(f"/documents/{doc_id}", headers=h_p1)
    assert del_again.status_code == 404
    print("  ✓ Subsequent requests return 404 Not Found.")

    print("\n" + "=" * 65)
    print("ALL DOCUMENT DELETION TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)


if __name__ == "__main__":
    test_delete_flow()
