from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from models import UserRole


# -------------------------------------------------------------
# Base & Nested Profile Schemas
# -------------------------------------------------------------
class PatientProfileBase(BaseModel):
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=50)
    phone_number: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = Field(None, max_length=255)
    emergency_contact_phone: Optional[str] = Field(None, max_length=50)
    blood_group: Optional[str] = Field(None, max_length=10)
    allergies: Optional[str] = None
    medical_history: Optional[str] = None


class PatientProfileUpdate(PatientProfileBase):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)


class PatientProfileResponse(PatientProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# -------------------------------------------------------------
# User Schemas
# -------------------------------------------------------------
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")
    full_name: str = Field(..., min_length=2, max_length=255)
    role: UserRole = Field(default=UserRole.PATIENT)
    provider_invite_code: Optional[str] = Field(None, description="Admin approval/invitation code required for healthcare providers")

    # Optional initial profile fields for patients
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=50)
    phone_number: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = Field(None, max_length=255)
    emergency_contact_phone: Optional[str] = Field(None, max_length=50)
    blood_group: Optional[str] = Field(None, max_length=10)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("provider_invite_code")
    @classmethod
    def validate_provider_code(cls, v: Optional[str], info) -> Optional[str]:
        # Role validation happens after role field is parsed
        role = info.data.get("role")
        if role == UserRole.PROVIDER:
            if not v or not v.strip():
                raise ValueError("Healthcare provider registration requires an invitation or admin approval code.")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    patient_profile: Optional[PatientProfileResponse] = None

    class Config:
        from_attributes = True


# -------------------------------------------------------------
# Token Schemas
# -------------------------------------------------------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    full_name: str
    role: str


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[str] = None

