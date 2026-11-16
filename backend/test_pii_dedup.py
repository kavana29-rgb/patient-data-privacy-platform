"""
Test Suite for PII Deduplication and Comprehensive Multi-Occurrence Redaction
in MyMedData.
"""
import os
import sys
import tempfile
import fitz

# Ensure backend root is on path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from app.modules.redaction.detector import detect_pii, normalize_pii_value
from app.modules.redaction.redactor import redact_pdf


def test_1_deduplication_on_multipage_pdf():
    """
    Verify on sample document with repeated patient details across 4 pages:
    - Exactly 5 unique PII entries are detected.
    - Each unique entry has count == 4.
    - 'Patient Name' is cleanly detected as 'Aarav Sharma' (not corrupted by 'Patient ID').
    """
    pdf_path = os.path.join(
        CURRENT_DIR,
        "secure_storage",
        "originals",
        "5_bb33b3e0c9d947f68f9e6aac91c35ad9_patient_aarav_sharma_records.pdf"
    )
    assert os.path.exists(pdf_path), f"Sample PDF not found at {pdf_path}"

    with fitz.open(pdf_path) as doc:
        text = "\n".join(page.get_text() for page in doc)

    unique_items = detect_pii(text, deduplicate=True)
    raw_items = detect_pii(text, deduplicate=False)

    print(f"\n[Test 1] Raw occurrences found: {len(raw_items)}")
    print(f"[Test 1] Unique PII items found: {len(unique_items)}")

    # 4 pages x 5 PII values = 20 raw occurrences
    assert len(raw_items) == 20, f"Expected 20 raw items, got {len(raw_items)}"
    assert len(unique_items) == 5, f"Expected exactly 5 unique items, got {len(unique_items)}"

    values_by_type = {item["type"]: item for item in unique_items}

    # Verify Patient Name is clean
    assert "Patient Name" in values_by_type
    name_item = values_by_type["Patient Name"]
    assert name_item["value"] == "Aarav Sharma", f"Unexpected name: {name_item['value']}"
    assert name_item["count"] == 4, f"Expected 4 occurrences, got {name_item['count']}"
    assert len(name_item["occurrences"]) == 4

    # Verify Aadhaar-like number
    assert "Aadhaar-like Number" in values_by_type
    aadhaar_item = values_by_type["Aadhaar-like Number"]
    assert aadhaar_item["value"] == "4521-8890-1234"
    assert aadhaar_item["count"] == 4

    # Verify Phone Number
    assert "Phone Number" in values_by_type
    phone_item = values_by_type["Phone Number"]
    assert phone_item["value"] == "+91-9876543210"
    assert phone_item["count"] == 4

    # Verify Email
    assert "Email" in values_by_type
    email_item = values_by_type["Email"]
    assert email_item["value"] == "aarav.sharma.demo@example.com"
    assert email_item["count"] == 4

    # Verify Address
    assert "Address" in values_by_type
    addr_item = values_by_type["Address"]
    assert "Indiranagar, Bengaluru" in addr_item["value"]
    assert addr_item["count"] == 4

    print("✓ Test 1 Passed: 5 unique items detected from 20 raw occurrences.")


def test_2_formatting_normalization_and_deduplication():
    """
    Verify normalized comparison of PII type and value:
    - Variations in whitespace, casing, and phone/aadhaar separators match as duplicates.
    """
    text_sample = """
    Patient Name: Aarav Sharma
    Patient Name: AARAV SHARMA
    Patient Name: Aarav   Sharma

    Phone: +91-9876543210
    Emergency Phone: +91 9876543210
    Alternate Phone: 9876543210

    Email: aarav.sharma.demo@example.com
    Email: AARAV.SHARMA.DEMO@EXAMPLE.COM

    ABHA: 4521-8890-1234
    ABHA: 4521 8890 1234
    """

    results = detect_pii(text_sample, deduplicate=True)
    assert len(results) == 4, f"Expected 4 unique items for 4 normalized entities, got {len(results)}"

    by_type = {item["type"]: item for item in results}
    assert by_type["Patient Name"]["count"] == 3
    assert by_type["Phone Number"]["count"] == 3
    assert by_type["Email"]["count"] == 2
    assert by_type["Aadhaar-like Number"]["count"] == 2

    print("✓ Test 2 Passed: Formatting differences normalized and deduplicated.")


def test_3_preserve_distinct_values_in_same_category():
    """
    Verify that distinct PII values in the same category are preserved as separate items.
    """
    text_sample = """
    Patient Name: Aarav Sharma
    Doctor Name: Priya Nair
    Doctor Phone: +91-9123456789
    Patient Phone: +91-9876543210
    Clinic Email: clinic@hospital.org
    Patient Email: aarav.sharma@example.com
    """

    results = detect_pii(text_sample, deduplicate=True)
    phone_items = [r for r in results if r["type"] == "Phone Number"]
    email_items = [r for r in results if r["type"] == "Email"]

    assert len(phone_items) == 2, f"Expected 2 distinct phones, got {len(phone_items)}"
    phone_vals = {p["value"] for p in phone_items}
    assert "+91-9123456789" in phone_vals
    assert "+91-9876543210" in phone_vals

    assert len(email_items) == 2, f"Expected 2 distinct emails, got {len(email_items)}"
    email_vals = {e["value"] for e in email_items}
    assert "clinic@hospital.org" in email_vals
    assert "aarav.sharma@example.com" in email_vals

    print("✓ Test 3 Passed: Distinct values in same category preserved.")


def test_4_selective_redaction_across_all_pages():
    """
    Verify important redaction requirement:
    - When a PII value is selected, ALL its occurrences across all pages are redacted.
    - When a PII value is not selected, NONE of its occurrences are redacted.
    """
    pdf_path = os.path.join(
        CURRENT_DIR,
        "secure_storage",
        "originals",
        "5_bb33b3e0c9d947f68f9e6aac91c35ad9_patient_aarav_sharma_records.pdf"
    )

    with tempfile.TemporaryDirectory() as td:
        out_path = os.path.join(td, "partially_redacted.pdf")

        # Select only Patient Name ('Aarav Sharma') and Email ('aarav.sharma.demo@example.com')
        # Do NOT select Phone Number or Aadhaar number.
        selected = ["Aarav Sharma", "aarav.sharma.demo@example.com"]

        found_count = redact_pdf(pdf_path, out_path, selected)
        # 4 occurrences of Aarav Sharma + 4 occurrences of Email = 8 instances redacted
        assert found_count == 8, f"Expected 8 redactions across 4 pages, got {found_count}"

        # Inspect resulting PDF
        with fitz.open(out_path) as redacted_doc:
            full_text = "\n".join(page.get_text() for page in redacted_doc)

            # Selected items must be 100% gone from all pages
            assert "Aarav Sharma" not in full_text, "Aarav Sharma found in redacted PDF!"
            assert "aarav.sharma.demo@example.com" not in full_text, "Email found in redacted PDF!"

            # Unselected items must be preserved on all pages
            assert "+91-9876543210" in full_text, "Phone was incorrectly redacted!"
            assert "4521-8890-1234" in full_text, "Aadhaar was incorrectly redacted!"
            assert "#42, 4th Cross" in full_text, "Address was incorrectly redacted!"

            # Check page by page that phone is present on all 4 pages
            for page_idx, page in enumerate(redacted_doc):
                page_text = page.get_text()
                assert "+91-9876543210" in page_text, f"Phone missing on page {page_idx + 1}"
                assert "Aarav Sharma" not in page_text, f"Aarav Sharma still on page {page_idx + 1}"

    print("✓ Test 4 Passed: Selective multi-page redaction verified. Selected items 100% redacted; unselected items 100% preserved.")


def test_5_full_redaction_all_items():
    """
    Verify full redaction when Select All is used:
    - All 5 unique items selected -> all 20 occurrences across all 4 pages are completely blacked out.
    """
    pdf_path = os.path.join(
        CURRENT_DIR,
        "secure_storage",
        "originals",
        "5_bb33b3e0c9d947f68f9e6aac91c35ad9_patient_aarav_sharma_records.pdf"
    )

    with tempfile.TemporaryDirectory() as td:
        out_path = os.path.join(td, "fully_redacted.pdf")

        all_unique = [
            "Aarav Sharma",
            "4521-8890-1234",
            "+91-9876543210",
            "aarav.sharma.demo@example.com",
            "#42, 4th Cross, Indiranagar, Bengaluru, Karnataka 560038"
        ]

        found_count = redact_pdf(pdf_path, out_path, all_unique)
        assert found_count == 20, f"Expected 20 redactions across 4 pages, got {found_count}"

        with fitz.open(out_path) as redacted_doc:
            full_text = "\n".join(page.get_text() for page in redacted_doc)
            for item in all_unique:
                assert item not in full_text, f"{item} still found in fully redacted PDF!"

    print("✓ Test 5 Passed: Full redaction removed all 20 occurrences across all pages.")


if __name__ == "__main__":
    print("Running PII Deduplication and Redaction Test Suite...")
    test_1_deduplication_on_multipage_pdf()
    test_2_formatting_normalization_and_deduplication()
    test_3_preserve_distinct_values_in_same_category()
    test_4_selective_redaction_across_all_pages()
    test_5_full_redaction_all_items()
    print("\n==========================================")
    print("ALL 5 TESTS PASSED SUCCESSFULLY!")
    print("==========================================")
