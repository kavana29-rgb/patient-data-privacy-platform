from sqlalchemy.orm import Session
from datetime import datetime
from app.modules.consent.models import ConsentRecord
from app.modules.consent.schemas import ConsentCreate

def create_consent(db: Session, consent: ConsentCreate, patient_id: int):
    db_consent = ConsentRecord(
        patient_id=patient_id,
        institution_id=consent.institution_id,
        document_id=consent.document_id,
        purpose=consent.purpose,
        expiry_date=consent.expiry_date,
        status="active"
    )
    db.add(db_consent)
    db.commit()
    db.refresh(db_consent)
    return db_consent

def get_consents_by_patient(db: Session, patient_id: int):
    now = datetime.utcnow()
    consents = db.query(ConsentRecord).filter(ConsentRecord.patient_id == patient_id).all()
    for c in consents:
        if c.status == "active" and c.expiry_date < now:
            c.status = "expired"
            db.commit()
    return consents

def revoke_consent(db: Session, consent_id: int, patient_id: int):
    consent = db.query(ConsentRecord).filter(ConsentRecord.id == consent_id, ConsentRecord.patient_id == patient_id).first()
    if not consent:
        return None
    consent.status = "revoked"
    consent.revoked_at = datetime.utcnow()
    db.commit()
    db.refresh(consent)
    return consent

def verify_consent(db: Session, institution_id: str, document_id: int, purpose: str):
    now = datetime.utcnow()
    consent = db.query(ConsentRecord).filter(
        ConsentRecord.institution_id == institution_id,
        ConsentRecord.document_id == document_id,
        ConsentRecord.purpose == purpose,
        ConsentRecord.status == "active",
        ConsentRecord.expiry_date > now
    ).first()
    return consent is not None