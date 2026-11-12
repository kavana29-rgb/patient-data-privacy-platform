from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ConsentCreate(BaseModel):
    institution_id: str
    document_id: int
    purpose: str
    expiry_date: datetime

class ConsentResponse(BaseModel):
    id: int
    patient_id: int
    institution_id: str
    document_id: int
    purpose: str
    expiry_date: datetime
    status: str
    created_at: datetime
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True