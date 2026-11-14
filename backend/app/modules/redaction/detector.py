
import re

PATTERNS = {
    "Email": re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
    ),
    "Phone Number": re.compile(
        r"(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)"
    ),
    "Aadhaar-like Number": re.compile(
        r"(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)"
    ),
    "Patient Name": re.compile(
    r"(?i)(?:patient\s*name|name)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})"
),
    "Address": re.compile(
        r"(?i)(?:address|residential address)\s*[:\-]\s*([^\n]+)"
    ),
}

def detect_pii(text: str):
    detected = []

    for category, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            # Name and address patterns capture only the value.
            if category in ["Patient Name", "Address"]:
                start, end = match.span(1)
                value = match.group(1)
            else:
                start, end = match.span()
                value = match.group()

            detected.append({
                "type": category,
                "value": value,
                "start": start,
                "end": end
            })

    detected.sort(key=lambda item: item["start"])
    return detected