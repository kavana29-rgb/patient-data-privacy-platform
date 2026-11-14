
import { useEffect, useState } from "react";
import { detectPII, redactPDF } from "./redactionApi";
import "./Redaction.css";
import { documentApi } from "../services/api";

function RedactionPage() {
  const [documents, setDocuments] = useState([]);
  const [documentId, setDocumentId] = useState("");
  const [detectedFields, setDetectedFields] = useState([]);
  const [selectedValues, setSelectedValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDocuments = async () => {
  try {
    const data = await documentApi.listDocuments();
    setDocuments(data);
  } catch (err) {
    setError(err.message);
  }
};

    loadDocuments();
  }, []);

  const handleDetect = async () => {
    if (!documentId) {
      setError("Please select a medical document.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setDetectedFields([]);
    setSelectedValues([]);

    try {
      const result = await detectPII(documentId);
      setDetectedFields(result.detected_fields || []);

      if (!result.detected_fields?.length) {
        setMessage("No personal information was detected.");
      }
    } catch (err) {
      setError(err.message);
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
      setMessage(
        "PDF successfully redacted. You can access the redacted version from your documents."
      );
      setSelectedValues([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="redaction-page">
      <h1>PII Detection & PDF Redaction</h1>

      <p>
        Select an uploaded medical document to detect and redact
        personal information.
      </p>

      <label htmlFor="document">Select Medical Document</label>

      <select
        id="document"
        value={documentId}
        onChange={(e) => {
          setDocumentId(e.target.value);
          setDetectedFields([]);
          setSelectedValues([]);
          setMessage("");
          setError("");
        }}
        style={{ display: "block", margin: "12px 0", padding: "10px", width: "100%" }}
      >
        <option value="">Choose a document</option>

        {documents.map((doc) => (
          <option key={doc.id} value={doc.id}>
            {doc.filename}
          </option>
        ))}
      </select>

      <button onClick={handleDetect} disabled={loading || !documentId}>
        {loading ? "Please wait..." : "Detect Personal Information"}
      </button>

      {error && <p className="error">{error}</p>}
{message && <p className="success">{message}</p>}

      {detectedFields.length > 0 && (
        <div style={{ marginTop: "25px" }}>
          <h2>Detected Personal Information</h2>

          <p>Select the information you want to redact.</p>

          {detectedFields.map((field, index) => (
            <label
  key={`${field.start}-${field.end}-${index}`}
  className="detected-field"
>
              <input
                type="checkbox"
                checked={selectedValues.includes(field.value)}
                onChange={() => handleSelection(field.value)}
              />

              <span>
                <strong>{field.type}:</strong> {field.value}
              </span>
            </label>
          ))}

          <button
            onClick={handleRedact}
            disabled={loading || selectedValues.length === 0}
            style={{ marginTop: "20px" }}
          >
            {loading ? "Redacting..." : "Redact Selected Fields"}
          </button>
        </div>
      )}
    </div>
  );
}

export default RedactionPage;
