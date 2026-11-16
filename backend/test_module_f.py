from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
from database import Base
from routers.audit import anonymize_expired_records


def test_demo_audit_seed_and_cleanup():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    patient = models.User(
        email="audit.patient@testhealth.org",
        hashed_password="hash",
        full_name="Audit Patient",
        role=models.UserRole.PATIENT,
        is_active=True,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    now = datetime.now(timezone.utc)
    old_log = models.AuditLog(
        patient_id=patient.id,
        institution_name="Old Clinic",
        document_name="Record.pdf",
        purpose="Past consult",
        action="view",
        consent_status="expired",
        access_time=now - timedelta(days=40),
    )
    db.add(old_log)
    db.commit()

    response = anonymize_expired_records(db=db, current_patient=patient)
    assert response["updated_records"] == 1

    refreshed = db.query(models.AuditLog).filter(models.AuditLog.id == old_log.id).first()
    assert refreshed.consent_status == "anonymized"
    assert refreshed.institution_name == "Anonymized Institution"
    assert refreshed.document_name == "Anonymized Document"
    db.close()


if __name__ == "__main__":
    test_demo_audit_seed_and_cleanup()
    print("test_module_f.py passed successfully!")
