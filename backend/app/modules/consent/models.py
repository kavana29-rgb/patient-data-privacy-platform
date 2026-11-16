from sqlalchemy import Column, Integer, String, DateTime, ForeignKey 
from sqlalchemy.orm import relationship  
from datetime import datetime
from app.database import Base

class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    institution_id = Column(String, nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("medical_documents.id"), nullable=False)
    purpose = Column(String, nullable=False)
    expiry_date = Column(DateTime, nullable=False)
    status = Column(String, default="active")  # active, expired, revoked
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)