const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
};

const handleResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }

    throw new Error(
      (data && (data.detail || data.message)) ||
      fallbackMessage
    );
  }

  return data;
};

// Detect PII in an uploaded medical PDF
export const detectPII = async (documentId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/redaction/detect/${documentId}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    return await handleResponse(
      response,
      "Failed to detect personal information."
    );
  } catch (error) {
    throw new Error(
      error.message || "Unable to connect to the backend."
    );
  }
};

// Permanently redact patient-selected fields
export const redactPDF = async (documentId, selectedValues) => {
  try {
    const formData = new FormData();

    formData.append(
      "selected_values",
      JSON.stringify(selectedValues)
    );

    const response = await fetch(
      `${API_BASE_URL}/api/redaction/redact/${documentId}`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      }
    );

    return await handleResponse(
      response,
      "Failed to redact the PDF."
    );
  } catch (error) {
    throw new Error(
      error.message || "Unable to connect to the backend."
    );
  }
};