from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.modules.consent.schemas import ConsentCreate, ConsentResponse
from app.modules.consent import crud
from app.dependencies import get_current_active_user

router = APIRouter(prefix="/api/consent", tags=["Consent Management"])

@router.post("/", response_model=ConsentResponse, status_code=status.HTTP_201_CREATED)
def grant_consent(consent: ConsentCreate, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can grant consent.")
    return crud.create_consent(db=db, consent=consent, patient_id=current_user.id)

@router.get("/", response_model=List[ConsentResponse])
def list_consents(db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can view their consents.")
    return crud.get_consents_by_patient(db=db, patient_id=current_user.id)

@router.patch("/{consent_id}/revoke", response_model=ConsentResponse)
def revoke_consent(consent_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can revoke consent.")
    consent = crud.revoke_consent(db=db, consent_id=consent_id, patient_id=current_user.id)
    if not consent:
        raise HTTPException(status_code=404, detail="Consent record not found.")
    return consent