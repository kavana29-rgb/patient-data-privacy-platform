import os
import shutil
import uuid
from typing import List
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_patient
import models
import schemas

router = APIRouter(prefix="/documents", tags=["Medical Documents"])

# Secure storage directory inside backend/
BASE_STORAGE_DIR = os.path.join("secure_storage", "originals")
os.makedirs(BASE_STORAGE_DIR, exist_ok=True)

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB limit


def _format_doc_response(doc: models.MedicalDocument) -> schemas.DocumentResponse:
    return schemas.DocumentResponse(
        id=doc.id,
        patient_id=doc.patient_id,
        filename=doc.filename,
        file_size_bytes=doc.file_size_bytes,
        status=doc.status,
        has_redacted=bool(doc.redacted_file_path and os.path.exists(doc.redacted_file_path)),
        uploaded_at=doc.uploaded_at,
    )


@router.post("/upload", response_model=schemas.DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_medical_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_patient: models.User = Depends(get_current_patient),
):
    # 1. Validate MIME type and file extension
    if file.content_type != "application/pdf" or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF documents are accepted."
        )

    # 2. Validate file size (max 5MB) and verify PDF magic header (%PDF-)
    header = await file.read(5)
    if header != b"%PDF-":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or invalid PDF file signature."
        )

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF file is empty."
        )

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 5 MB limit."
        )

    # 3. Save securely using a UUID prefix so filenames never collide or leak paths
    safe_original_name = os.path.basename(file.filename)
    unique_storage_name = f"{current_patient.id}_{uuid.uuid4().hex}_{safe_original_name}"
    file_path = os.path.join(BASE_STORAGE_DIR, unique_storage_name)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store document securely on server."
        ) from exc

    # 4. Save document metadata in PostgreSQL
    new_doc = models.MedicalDocument(
        patient_id=current_patient.id,
        filename=safe_original_name,
        original_file_path=file_path,
        file_size_bytes=file_size,
        status="Uploaded",
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    return _format_doc_response(new_doc)


@router.get("/", response_model=List[schemas.DocumentResponse])
def list_patient_documents(
    db: Session = Depends(get_db),
    current_patient: models.User = Depends(get_current_patient),
):
    docs = (
        db.query(models.MedicalDocument)
        .filter(models.MedicalDocument.patient_id == current_patient.id)
        .order_by(models.MedicalDocument.uploaded_at.desc())
        .all()
    )
    return [_format_doc_response(doc) for doc in docs]


@router.get("/{doc_id}/file")
def get_document_file(
    doc_id: int,
    version: str = "original",  # "original" or "redacted"
    db: Session = Depends(get_db),
    current_patient: models.User = Depends(get_current_patient),
):
    if version not in ("original", "redacted"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Version must be either 'original' or 'redacted'."
        )

    doc = (
        db.query(models.MedicalDocument)
        .filter(
            models.MedicalDocument.id == doc_id,
            models.MedicalDocument.patient_id == current_patient.id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical document not found."
        )

    target_path = doc.redacted_file_path if version == "redacted" else doc.original_file_path

    if not target_path or not os.path.exists(target_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"The {version} version of this document is not available yet."
        )

    return FileResponse(
        path=target_path,
        media_type="application/pdf",
        filename=f"{version}_{doc.filename}",
    )


@router.delete("/{doc_id}", status_code=status.HTTP_200_OK)
def delete_medical_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_patient: models.User = Depends(get_current_patient),
):
    """
    Deletes an uploaded medical document with patient ownership verification,
    foreign-key constraint handling, and physical storage removal.
    """
    doc = (
        db.query(models.MedicalDocument)
        .filter(models.MedicalDocument.id == doc_id)
        .first()
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical document not found."
        )

    if doc.patient_id != current_patient.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not own this document."
        )

    # 1. Nullify document references in access audit logs to preserve audit trail
    try:
        db.query(models.AccessAuditLog).filter(
            models.AccessAuditLog.document_id == doc_id
        ).update({models.AccessAuditLog.document_id: None})
    except Exception:
        db.rollback()

    # 2. Delete associated provider access requests
    try:
        db.query(models.ProviderAccessRequest).filter(
            models.ProviderAccessRequest.document_id == doc_id
        ).delete()
    except Exception:
        db.rollback()

    # 3. Delete associated consent records if present
    try:
        if hasattr(models, "ConsentRecord"):
            db.query(models.ConsentRecord).filter(
                models.ConsentRecord.document_id == doc_id
            ).delete()
    except Exception:
        db.rollback()

    # 4. Safely remove physical files from storage
    file_paths = [doc.original_file_path, doc.redacted_file_path]
    for path in file_paths:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass

    filename = doc.filename
    db.delete(doc)
    db.commit()

    return {
        "message": f"Document '{filename}' deleted successfully.",
        "id": doc_id,
        "filename": filename
    }
