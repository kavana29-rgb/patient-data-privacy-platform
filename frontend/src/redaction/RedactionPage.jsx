import { useEffect, useState } from "react";
import { detectPII, redactPDF } from "./redactionApi";
import { documentApi } from "../services/api";
import { useToast } from "../context/useToast";

function normalizePIIKey(type, value) {
  const trimmed = (value || "").replace(/\s+/g, " ").trim();
  const lower = trimmed.toLowerCase();
  if (type === "Email") return `Email:${lower}`;
  if (type === "Phone Number") {
    const digits = trimmed.replace(/\D/g, "");
    return `Phone Number:${digits.length >= 10 ? digits.slice(-10) : digits}`;
  }
  if (type === "Aadhaar-like Number") {
    return `Aadhaar-like Number:${trimmed.replace(/[\s-]/g, "")}`;
  }
  if (type === "Patient Name") {
    return `Patient Name:${lower}`;
  }
  if (type === "Address") {
    return `Address:${lower.replace(/[,.\s]+$/, "")}`;
  }
  return `${type}:${lower}`;
}

function deduplicateDetectedFields(fields) {
  if (!Array.isArray(fields)) return [];
  const map = new Map();

  for (const item of fields) {
    if (!item || !item.value) continue;
    const cleanValue = (item.value || "").replace(/\s+/g, " ").trim();
    if (!cleanValue) continue;

    const key = normalizePIIKey(item.type, cleanValue);
    if (!map.has(key)) {
      map.set(key, {
        ...item,
        value: cleanValue,
        count: item.count || 1,
        occurrences: item.occurrences || [{ raw_value: item.value }],
      });
    } else {
      const existing = map.get(key);
      existing.count = (existing.count || 1) + (item.count || 1);
      if (item.occurrences) {
        existing.occurrences = [...(existing.occurrences || []), ...item.occurrences];
      }
      if (cleanValue.length > existing.value.length) {
        existing.value = cleanValue;
      }
    }
  }

  return Array.from(map.values());
}

function RedactionPage({ preselectedDocId }) {
  const { showToast } = useToast();

  const [documents, setDocuments] = useState([]);
  const [documentId, setDocumentId] = useState(preselectedDocId ? String(preselectedDocId) : "");
  const [detectedFields, setDetectedFields] = useState([]);
  const [selectedValues, setSelectedValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [redactedDocId, setRedactedDocId] = useState(null);

  // In-app preview state for redacted document
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    let ignore = false;
    documentApi.listDocuments()
      .then((data) => {
        if (!ignore) {
          setDocuments(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load documents list.");
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleDetect = async () => {
    if (!documentId) {
      setError("Please choose a medical document from your vault.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setDetectedFields([]);
    setSelectedValues([]);
    setRedactedDocId(null);

    try {
      const result = await detectPII(documentId);
      const rawFields = result.detected_fields || [];
      const uniqueFields = deduplicateDetectedFields(rawFields);
      setDetectedFields(uniqueFields);

      if (uniqueFields.length === 0) {
        setMessage("No personally identifiable information (PII) was detected in this document.");
        showToast("Scan complete: No PII detected.", "info");
      } else {
        // Pre-select all detected unique fields by default for user convenience & safety
        setSelectedValues(uniqueFields.map((f) => f.value));
        setMessage(`Found ${uniqueFields.length} unique personal data field(s). Review selections below.`);
        showToast(`Detected ${uniqueFields.length} unique personal data field(s).`, "success");
      }
    } catch (err) {
      const msg = err.message || "PII detection scan failed.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelection = (value) => {
    setSelectedValues((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value]
    );
  };

  const handleSelectAll = () => {
    setSelectedValues(detectedFields.map((f) => f.value));
  };

  const handleClearAll = () => {
    setSelectedValues([]);
  };

  const handleRedact = async () => {
    if (!selectedValues.length) {
      setError("Please select at least one field to redact.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await redactPDF(documentId, selectedValues);
      setMessage("Document successfully redacted and securely stored! Authorized healthcare providers will only receive this sanitized version.");
      setRedactedDocId(documentId);
      showToast("Document redacted successfully!", "success");
    } catch (err) {
      const msg = err.message || "Redaction processing failed.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadRedacted = async () => {
    if (!redactedDocId) return;
    try {
      const blob = await documentApi.fetchDocumentBlob(redactedDocId, "redacted");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redacted_doc_${redactedDocId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Redacted PDF downloaded.", "success");
    } catch (err) {
      showToast(err.message || "Could not download redacted PDF.", "error");
    }
  };

  const handlePreviewRedacted = async () => {
    if (!redactedDocId) return;
    try {
      const blob = await documentApi.fetchDocumentBlob(redactedDocId, "redacted");
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setShowPreviewModal(true);
    } catch (err) {
      showToast(err.message || "Could not load preview.", "error");
    }
  };

  const handleClosePreviewModal = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setShowPreviewModal(false);
  };

  return (
    <div className="card" style={{ padding: "1.75rem", marginTop: "1.5rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ margin: "0 0 0.25rem 0", fontSize: "1.35rem", color: "var(--text-primary)", fontWeight: "700" }}>
          PII Detection & Redaction Studio
        </h2>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.885rem" }}>
          Scan medical documents for sensitive Personally Identifiable Information (Names, Phone Numbers, Aadhaar, Addresses, Email).
          Each unique detail is grouped once; choosing an item permanently blackens out all occurrences across all pages before sharing.
        </p>
      </div>

      {/* Document Selector & Action */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "end", marginBottom: "1.25rem" }}>
        <div>
          <label htmlFor="document-select" style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Select Medical Document
          </label>
          <select
            id="document-select"
            value={documentId}
            onChange={(e) => {
              setDocumentId(e.target.value);
              setDetectedFields([]);
              setSelectedValues([]);
              setMessage("");
              setError("");
              setRedactedDocId(null);
            }}
            className="form-control"
            style={{ width: "100%", padding: "10px" }}
          >
            <option value="">-- Choose a document from your vault --</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filename} (ID: #{doc.id}) {doc.has_redacted ? "— [Already Redacted]" : ""}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleDetect}
          disabled={loading || !documentId}
          className="btn btn-primary"
          style={{ whiteSpace: "nowrap", height: "42px" }}
        >
          {loading ? (
            <>
              <span className="spinner-sm"></span> Scanning...
            </>
          ) : (
            "🔍 Scan Document for PII"
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: "1rem" }}>
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="alert alert-info" role="status" style={{ marginBottom: "1rem" }}>
          <span className="alert-icon">ℹ️</span>
          <span>{message}</span>
        </div>
      )}

      {/* Redacted Ready Notice Banner */}
      {redactedDocId && (
        <div style={{
          padding: "1rem 1.25rem",
          backgroundColor: "var(--success-bg)",
          border: "1px solid var(--success-border)",
          borderRadius: "var(--radius-md)",
          marginBottom: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px"
        }}>
          <span style={{ color: "var(--success-text)", fontWeight: "600", fontSize: "0.9rem" }}>
            ✅ Redacted version created and verified in your secure vault.
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handlePreviewRedacted}
              className="btn btn-outline btn-sm"
              style={{ borderColor: "var(--success-border)", color: "var(--success-text)" }}
            >
              👁️ Preview Redacted
            </button>
            <button
              type="button"
              onClick={handleDownloadRedacted}
              className="btn btn-primary btn-sm"
            >
              📥 Download Redacted PDF
            </button>
          </div>
        </div>
      )}

      {/* Detected PII List */}
      {detectedFields.length > 0 && (
        <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)", fontWeight: "700" }}>
              Detected Personal Information ({detectedFields.length} unique)
            </h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleSelectAll}
                className="btn btn-outline btn-sm"
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="btn btn-outline btn-sm"
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              >
                Clear All
              </button>
            </div>
          </div>

          <p style={{ margin: "0 0 1rem 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Each unique personal detail is shown once below. Selecting an item will permanently black out all its occurrences across every page of this document:
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px", marginBottom: "1.25rem" }}>
            {detectedFields.map((field, index) => {
              const isChecked = selectedValues.includes(field.value);
              return (
                <label
                  key={`${field.type}-${field.value}-${index}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: `1.5px solid ${isChecked ? "var(--primary)" : "var(--border-color)"}`,
                    backgroundColor: isChecked ? "var(--primary-subtle)" : "var(--bg-card)",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", minWidth: 0, width: "100%" }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleSelection(field.value)}
                      style={{ marginTop: "3px", flexShrink: 0, accentColor: "var(--primary)" }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px", flexWrap: "wrap" }}>
                        <span style={{
                          display: "inline-block",
                          fontSize: "0.7rem",
                          fontWeight: "700",
                          padding: "1px 6px",
                          borderRadius: "var(--radius-xs)",
                          backgroundColor: "var(--bg-muted)",
                          color: "var(--text-secondary)",
                          textTransform: "uppercase",
                        }}>
                          {field.type}
                        </span>
                        {field.count > 1 && (
                          <span style={{
                            display: "inline-block",
                            fontSize: "0.7rem",
                            fontWeight: "600",
                            padding: "1px 6px",
                            borderRadius: "var(--radius-xs)",
                            backgroundColor: "var(--primary-light)",
                            color: "var(--primary)",
                          }}>
                            {field.count} occurrences
                          </span>
                        )}
                      </div>
                      <strong style={{
                        color: "var(--text-primary)",
                        display: "block",
                        wordBreak: "break-word",
                        lineHeight: "1.35",
                      }}>
                        {field.value}
                      </strong>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleRedact}
            disabled={loading || selectedValues.length === 0}
            className="btn btn-primary"
            style={{ padding: "10px 22px" }}
          >
            {loading ? (
              <>
                <span className="spinner-sm"></span> Redacting Document...
              </>
            ) : (
              `🔒 Redact Selected Items (${selectedValues.length})`
            )}
          </button>
        </div>
      )}

      {/* Redacted PDF Preview Modal */}
      {showPreviewModal && previewUrl && (
        <div className="modal-overlay" onClick={handleClosePreviewModal}>
          <div className="modal-card" style={{ maxWidth: "850px", height: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.25rem" }}>🛡️</span>
                <h3 style={{ margin: 0 }}>Redacted Document Preview</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={handleClosePreviewModal}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ flex: 1, padding: 0, overflow: "hidden" }}>
              <iframe
                src={previewUrl}
                title="Redacted PDF Preview"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadRedacted}>
                📥 Download Redacted PDF
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleClosePreviewModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RedactionPage;
