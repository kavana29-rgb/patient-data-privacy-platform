
import fitz

def redact_pdf(input_path, output_path, selected_values):
    """
    Permanently redact selected text values from a PDF.
    """
    if not selected_values:
        raise ValueError("Select at least one field to redact.")

    document = fitz.open(input_path)

    try:
        found_count = 0

        for page in document:
            for value in selected_values:
                if not value:
                    continue

                matches = page.search_for(value)

                for rect in matches:
                    page.add_redact_annot(rect, fill=(0, 0, 0))
                    found_count += 1

            page.apply_redactions()

        if found_count == 0:
            raise ValueError(
                "None of the selected text was found in the PDF."
            )

        document.save(
            output_path,
            garbage=4,
            deflate=True
        )

        return found_count

    finally:
        document.close()