
import fitz
import tempfile
import os

from app.modules.redaction.redactor import redact_pdf

with tempfile.TemporaryDirectory() as temp_dir:

    input_path = os.path.join(temp_dir, "sample.pdf")
    output_path = os.path.join(temp_dir, "redacted.pdf")

    # Create a synthetic medical PDF
    doc = fitz.open()
    page = doc.new_page()

    page.insert_text(
        (50, 80),
        "Patient Name: John Doe",
        fontsize=14
    )

    page.insert_text(
        (50, 110),
        "Diagnosis: General Checkup",
        fontsize=14
    )

    doc.save(input_path)
    doc.close()

    # Redact the patient's name
    count = redact_pdf(
        input_path,
        output_path,
        ["John Doe"]
    )

    # Verify the output PDF
    result = fitz.open(output_path)
    extracted_text = "\n".join(
        page.get_text() for page in result
    )

    print("Redaction count:", count)
    print("Redacted PDF text:")
    print(extracted_text)

    if "John Doe" not in extracted_text:
        print("SUCCESS: Patient name was redacted!")
    else:
        print("FAILED: Patient name is still present!")

    result.close()