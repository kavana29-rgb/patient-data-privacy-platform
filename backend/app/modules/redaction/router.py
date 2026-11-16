import os
import json
import uuid

import fitz

from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_patient
import models

from app.modules.redaction.detector import detect_pii
from app.modules.redaction.redactor import redact_pdf


router = APIRouter(prefix="/api/redaction", tags=["PII Redaction"])

MAX_FILE_SIZE = 5 * 1024 * 1024

REDACTED_STORAGE_DIR = os.path.join("secure_storage", "redacted")


def get_patient_document(doc_id, db, current_patient):
    document = (
        db.query(models.MedicalDocument)
        .filter(
            models.MedicalDocument.id == doc_id,
            models.MedicalDocument.patient_id == current_patient.id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Medical document not found."
        )

    return document


def extract_pdf_text(file_path):
    try:
        with fitz.open(file_path) as document:
            text = "\n".join(page.get_text() for page in document)
            return text
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid or unreadable PDF."
        )


@router.get("/detect/{doc_id}")
def detect_fields(
    doc_id: int,
    db: Session = Depends(get_db),
    current_patient=Depends(get_current_patient)
):
    document = get_patient_document(doc_id, db, current_patient)

    if not os.path.exists(document.original_file_path):
        raise HTTPException(
            status_code=404,
            detail="Original PDF not found."
        )

    if os.path.getsize(document.original_file_path) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="PDF exceeds the 5 MB limit."
        )

    text = extract_pdf_text(document.original_file_path)

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="No selectable text found. Scanned PDFs require OCR."
        )

    return {
        "document_id": document.id,
        "filename": document.filename,
        "detected_fields": detect_pii(text)
    }


@router.post("/redact/{doc_id}")
def redact_fields(
    doc_id: int,
    selected_values: str = Form(...),
    db: Session = Depends(get_db),
    current_patient=Depends(get_current_patient)
):
    document = get_patient_document(doc_id, db, current_patient)

    if not os.path.exists(document.original_file_path):
        raise HTTPException(
            status_code=404,
            detail="Original PDF not found."
        )

    try:
        selected = json.loads(selected_values)

        if (
            not isinstance(selected, list)
            or not selected
            or not all(isinstance(value, str) and value.strip() for value in selected)
        ):
            raise ValueError()

    except (ValueError, json.JSONDecodeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid selected fields."
        )

    text = extract_pdf_text(document.original_file_path)
    detected_unique = detect_pii(text, deduplicate=True)
    detected_values = {
        item["value"] for item in detected_unique
    }

    if not set(selected).issubset(detected_values):
        raise HTTPException(
            status_code=400,
            detail="One or more selected fields were not detected."
        )

    os.makedirs(REDACTED_STORAGE_DIR, exist_ok=True)

    output_filename = f"{doc_id}_{uuid.uuid4().hex}_redacted.pdf"
    output_path = os.path.join(
        REDACTED_STORAGE_DIR,
        output_filename
    )

    try:
        # Collect all occurrence strings and display strings for selected items
        # to ensure every occurrence across all pages of the PDF is permanently redacted.
        search_values = []
        for item in detected_unique:
            if item["value"] in selected:
                search_values.append(item["value"])
                for occ in item.get("occurrences", []):
                    raw_val = occ.get("raw_value")
                    if raw_val and raw_val.strip():
                        search_values.append(raw_val.strip())

        unique_search_values = list(dict.fromkeys(search_values))

        redact_pdf(
            document.original_file_path,
            output_path,
            unique_search_values
        )

        document.redacted_file_path = output_path
        document.status = "Redacted"

        db.commit()
        db.refresh(document)

    except ValueError as error:
        if os.path.exists(output_path):
            os.remove(output_path)

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception:
        db.rollback()

        if os.path.exists(output_path):
            os.remove(output_path)

        raise HTTPException(
            status_code=500,
            detail="Failed to save the redacted document."
        )

    return {
        "message": "PDF successfully redacted.",
        "document_id": document.id,
        "status": document.status,
        "has_redacted": True
    }