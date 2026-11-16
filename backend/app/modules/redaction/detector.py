
import re

PATTERNS = {
    "Email": re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
    ),
    "Phone Number": re.compile(
        r"(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)"
    ),
    "Aadhaar-like Number": re.compile(
        r"(?<!\d)[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}(?!\d)"
    ),
    "Patient Name": re.compile(
        r"(?i)(?:patient\s*name|name)[ \t]*[:\-][ \t]*([A-Za-z]+(?:[ \t]+[A-Za-z]+){0,3})"
    ),
    "Address": re.compile(
        r"(?i)(?:address|residential address)[ \t]*[:\-][ \t]*([^\r\n]+)"
    ),
}


def normalize_pii_value(category: str, value: str) -> str:
    """
    Produce a normalized key for duplicate comparison.
    Collapses multiple whitespaces, trims, and normalizes formatting per category.
    """
    val = re.sub(r"\s+", " ", value).strip()

    if category == "Email":
        return val.lower()

    if category == "Phone Number":
        digits = re.sub(r"\D", "", val)
        if len(digits) >= 10:
            return digits[-10:]
        return digits

    if category == "Aadhaar-like Number":
        return re.sub(r"[\s-]", "", val)

    if category == "Patient Name":
        return val.lower()

    if category == "Address":
        return re.sub(r"[,\.\s]+$", "", val.lower())

    return val.lower()


def detect_pii(text: str, deduplicate: bool = True):
    """
    Scan text for PII patterns.
    When deduplicate=True (default), unique PII values are returned once with:
      - 'value': normalized display string
      - 'count': total occurrences found
      - 'occurrences': list of all raw occurrence locations and raw strings
    """
    raw_detections = []

    for category, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            if category in ["Patient Name", "Address"]:
                start, end = match.span(1)
                value = match.group(1).strip()
            else:
                start, end = match.span()
                value = match.group().strip()

            if not value:
                continue

            raw_detections.append({
                "type": category,
                "raw_value": value,
                "start": start,
                "end": end
            })

    raw_detections.sort(key=lambda item: item["start"])

    if not deduplicate:
        return [
            {
                "type": item["type"],
                "value": item["raw_value"],
                "start": item["start"],
                "end": item["end"]
            }
            for item in raw_detections
        ]

    unique_map = {}
    for item in raw_detections:
        category = item["type"]
        norm_key = normalize_pii_value(category, item["raw_value"])
        group_key = (category, norm_key)
        clean_value = re.sub(r"\s+", " ", item["raw_value"]).strip()

        if group_key not in unique_map:
            unique_map[group_key] = {
                "type": category,
                "value": clean_value,
                "start": item["start"],
                "end": item["end"],
                "count": 1,
                "occurrences": [
                    {
                        "start": item["start"],
                        "end": item["end"],
                        "raw_value": item["raw_value"]
                    }
                ]
            }
        else:
            entry = unique_map[group_key]
            entry["count"] += 1
            entry["occurrences"].append({
                "start": item["start"],
                "end": item["end"],
                "raw_value": item["raw_value"]
            })
            # Prefer longer or better-formatted value representation
            if len(clean_value) > len(entry["value"]):
                entry["value"] = clean_value

    unique_entries = list(unique_map.values())
    unique_entries.sort(key=lambda item: item["start"])
    return unique_entries
