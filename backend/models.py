import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Date,
    Text,
    ForeignKey,
    Enum as SAEnum,
    func
)
from sqlalchemy.orm import relationship
from database import Base


class UserRole(str, enum.Enum):
    PATIENT = "patient"
    PROVIDER = "provider"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(
        SAEnum(UserRole, name="user_role", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=UserRole.PATIENT
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # 1-to-1 relationship with PatientProfile (for patients)
    patient_profile = relationship(
        "PatientProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User id={self.id} email={self.email} role={self.role}>"


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(50), nullable=True)
    phone_number = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    blood_group = Column(String(10), nullable=True)
    allergies = Column(Text, nullable=True)
    medical_history = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="patient_profile")

    def __repr__(self):
        return f"<PatientProfile id={self.id} user_id={self.user_id}>"
class MedicalDocument(Base):
    __tablename__ = "medical_documents"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    filename = Column(String(255), nullable=False)
    original_file_path = Column(String(500), nullable=False)
    redacted_file_path = Column(String(500), nullable=True)
    file_size_bytes = Column(Integer, nullable=False)
    status = Column(String(50), default="Uploaded", nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<MedicalDocument id={self.id} filename={self.filename} patient_id={self.patient_id}>"

class ProviderAccessRequest(Base):
    __tablename__ = "provider_access_requests"

    id = Column(Integer, primary_key=True, index=True)

    # Provider requesting access
    provider_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    # Patient whose document is requested
    patient_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    # Specific medical document
    document_id = Column(
        Integer,
        ForeignKey("medical_documents.id"),
        nullable=False,
        index=True
    )

    # Reason for requesting access
    purpose = Column(Text, nullable=False)

    # Pending, Approved, Rejected or Revoked
    status = Column(String(30), default="Pending", nullable=False)

    requested_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    responded_at = Column(DateTime(timezone=True), nullable=True)

    # Permission expiry
    expires_at = Column(DateTime(timezone=True), nullable=True)

    decision_note = Column(Text, nullable=True)


class AccessAuditLog(Base):
    __tablename__ = "access_audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    provider_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    document_id = Column(
        Integer,
        ForeignKey("medical_documents.id"),
        nullable=True
    )

    request_id = Column(
        Integer,
        ForeignKey("provider_access_requests.id"),
        nullable=True
    )

    # Example: REQUEST_CREATED, CONSENT_APPROVED,
    # DOCUMENT_ACCESS_GRANTED, DOCUMENT_ACCESS_DENIED
    action = Column(String(100), nullable=False)

    success = Column(Boolean, default=True, nullable=False)

    details = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    institution_name = Column(String(255), nullable=False, default="Unknown Institution")
    document_name = Column(String(255), nullable=False)
    purpose = Column(String(255), nullable=False)
    action = Column(String(50), nullable=False, default="view")
    consent_status = Column(String(50), nullable=False, default="active")
    access_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")

    def __repr__(self):
        return f"<AuditLog id={self.id} patient_id={self.patient_id} institution={self.institution_name}>"




