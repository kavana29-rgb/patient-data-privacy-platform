
from datetime import datetime, timezone
from typing import List
import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import deps


router = APIRouter(
    prefix="/sharing",
    tags=["Secure Document Sharing"]
)


# -------------------------------------------------------------
# HELPER: Record access audit logs
# -------------------------------------------------------------

def record_audit(
    db: Session,
    provider_id: int,
    patient_id: int,
    action: str,
    document_id: int = None,
    request_id: int = None,
    success: bool = True,
    details: str = None,
):
    log = models.AccessAuditLog(
        provider_id=provider_id,
        patient_id=patient_id,
        document_id=document_id,
        request_id=request_id,
        action=action,
        success=success,
        details=details,
    )
    db.add(log)


# -------------------------------------------------------------
# PROVIDER: Request access to a patient's document
# -------------------------------------------------------------

@router.post(
    "/requests",
    response_model=schemas.ProviderAccessRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_access_request(
    request_data: schemas.ProviderAccessRequestCreate,
    current_provider: models.User = Depends(deps.get_current_provider),
    db: Session = Depends(get_db),
):
    patient = db.query(models.User).filter(
        models.User.id == request_data.patient_id,
        models.User.role == models.UserRole.PATIENT,
        models.User.is_active == True,
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found."
        )

    document = db.query(models.MedicalDocument).filter(
        models.MedicalDocument.id == request_data.document_id,
        models.MedicalDocument.patient_id == patient.id,
    ).first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found for this patient."
        )

    existing = db.query(models.ProviderAccessRequest).filter(
        models.ProviderAccessRequest.provider_id == current_provider.id,
        models.ProviderAccessRequest.document_id == document.id,
        models.ProviderAccessRequest.status == "Pending",
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="A pending request already exists for this document."
        )

    new_request = models.ProviderAccessRequest(
        provider_id=current_provider.id,
        patient_id=patient.id,
        document_id=document.id,
        purpose=request_data.purpose,
        status="Pending",
    )

    db.add(new_request)
    db.flush()

    record_audit(
        db,
        provider_id=current_provider.id,
        patient_id=patient.id,
        document_id=document.id,
        request_id=new_request.id,
        action="REQUEST_CREATED",
        details="Provider requested access to a medical document.",
    )

    db.commit()
    db.refresh(new_request)

    return new_request


# -------------------------------------------------------------
# PROVIDER: View own access requests
# -------------------------------------------------------------

@router.get(
    "/provider/requests",
    response_model=List[schemas.ProviderAccessRequestResponse],
)
def get_provider_requests(
    current_provider: models.User = Depends(deps.get_current_provider),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.ProviderAccessRequest)
        .filter(
            models.ProviderAccessRequest.provider_id == current_provider.id
        )
        .order_by(models.ProviderAccessRequest.requested_at.desc())
        .all()
    )


# -------------------------------------------------------------
# PATIENT: View requests made for their documents
# -------------------------------------------------------------

@router.get(
    "/patient/requests",
    response_model=List[schemas.ProviderAccessRequestResponse],
)
def get_patient_requests(
    current_patient: models.User = Depends(deps.get_current_patient),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.ProviderAccessRequest)
        .filter(
            models.ProviderAccessRequest.patient_id == current_patient.id
        )
        .order_by(models.ProviderAccessRequest.requested_at.desc())
        .all()
    )


# -------------------------------------------------------------
# PATIENT: Approve or reject a provider request
# -------------------------------------------------------------

@router.patch(
    "/patient/requests/{request_id}/decision",
    response_model=schemas.ProviderAccessRequestResponse,
)
def decide_access_request(
    request_id: int,
    decision: schemas.PatientConsentDecision,
    current_patient: models.User = Depends(deps.get_current_patient),
    db: Session = Depends(get_db),
):
    access_request = db.query(models.ProviderAccessRequest).filter(
        models.ProviderAccessRequest.id == request_id,
        models.ProviderAccessRequest.patient_id == current_patient.id,
    ).first()

    if not access_request:
        raise HTTPException(
            status_code=404,
            detail="Access request not found."
        )

    if access_request.status != "Pending":
        raise HTTPException(
            status_code=400,
            detail="This request has already been processed."
        )

    if decision.status == "Approved":
        if decision.expires_at is None:
            raise HTTPException(
                status_code=400,
                detail="An expiry date is required for approval."
            )

        expiry = decision.expires_at

        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)

        if expiry <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=400,
                detail="Expiry date must be in the future."
            )

        access_request.expires_at = expiry

    else:
        access_request.expires_at = None

    access_request.status = decision.status
    access_request.responded_at = datetime.now(timezone.utc)
    access_request.decision_note = decision.decision_note

    record_audit(
        db,
        provider_id=access_request.provider_id,
        patient_id=current_patient.id,
        document_id=access_request.document_id,
        request_id=access_request.id,
        action=(
            "CONSENT_APPROVED"
            if decision.status == "Approved"
            else "CONSENT_REJECTED"
        ),
        details=decision.decision_note,
    )

    db.commit()
    db.refresh(access_request)

    return access_request


# -------------------------------------------------------------
# PROVIDER: Retrieve an approved redacted document
# -------------------------------------------------------------

@router.get("/requests/{request_id}/document")
def get_approved_document(
    request_id: int,
    current_provider: models.User = Depends(deps.get_current_provider),
    db: Session = Depends(get_db),
):
    access_request = db.query(models.ProviderAccessRequest).filter(
        models.ProviderAccessRequest.id == request_id,
        models.ProviderAccessRequest.provider_id == current_provider.id,
    ).first()

    if not access_request:
        raise HTTPException(
            status_code=404,
            detail="Access request not found."
        )

    expiry = access_request.expires_at

    if expiry is not None and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    is_valid = (
        access_request.status == "Approved"
        and expiry is not None
        and expiry > datetime.now(timezone.utc)
    )

    if not is_valid:
        if access_request.status == "Approved":
            access_request.status = "Expired"

        record_audit(
            db,
            provider_id=current_provider.id,
            patient_id=access_request.patient_id,
            document_id=access_request.document_id,
            request_id=access_request.id,
            action="DOCUMENT_ACCESS_DENIED",
            success=False,
            details="No valid patient approval or permission has expired.",
        )

        db.commit()

        raise HTTPException(
            status_code=403,
            detail="Patient approval is missing or has expired."
        )

    document = db.query(models.MedicalDocument).filter(
        models.MedicalDocument.id == access_request.document_id,
        models.MedicalDocument.patient_id == access_request.patient_id,
    ).first()

    if not document or not document.redacted_file_path:
        record_audit(
            db,
            provider_id=current_provider.id,
            patient_id=access_request.patient_id,
            document_id=access_request.document_id,
            request_id=access_request.id,
            action="DOCUMENT_ACCESS_FAILED",
            success=False,
            details="Redacted document is not available.",
        )

        db.commit()

        raise HTTPException(
            status_code=404,
            detail="Redacted document is not available."
        )

    if not os.path.exists(document.redacted_file_path):
        record_audit(
            db,
            provider_id=current_provider.id,
            patient_id=access_request.patient_id,
            document_id=access_request.document_id,
            request_id=access_request.id,
            action="DOCUMENT_ACCESS_FAILED",
            success=False,
            details="Document file could not be found.",
        )

        db.commit()

        raise HTTPException(
            status_code=404,
            detail="Document file could not be found."
        )

    record_audit(
        db,
        provider_id=current_provider.id,
        patient_id=access_request.patient_id,
        document_id=document.id,
        request_id=access_request.id,
        action="DOCUMENT_ACCESS_GRANTED",
        details="Provider retrieved an approved redacted document.",
    )

    db.commit()

    return FileResponse(
        path=document.redacted_file_path,
        media_type="application/pdf",
        filename=f"redacted_{document.filename}",
    )

# -------------------------------------------------------------
# PATIENT: View own document access history
# -------------------------------------------------------------

@router.get(
    "/patient/audit-history",
    response_model=List[schemas.AccessAuditLogResponse],
)
def get_patient_audit_history(
    current_patient: models.User = Depends(deps.get_current_patient),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.AccessAuditLog)
        .filter(
            models.AccessAuditLog.patient_id == current_patient.id
        )
        .order_by(models.AccessAuditLog.created_at.desc())
        .all()
    )
