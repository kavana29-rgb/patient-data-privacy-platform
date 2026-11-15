
import { useEffect, useState } from 'react';
import { sharingApi } from '../services/api';

export default function ProviderDashboard() {
  const [patientId, setPatientId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [purpose, setPurpose] = useState('');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load the provider's existing access requests
  const loadRequests = async () => {
    try {
      setError('');
      const data = await sharingApi.getProviderRequests();
      setRequests(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Submit a new patient document access request
  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!patientId || !documentId || !purpose.trim()) {
      setError('Please complete all fields.');
      return;
    }

    try {
      setSubmitting(true);

      await sharingApi.createRequest({
        patient_id: Number(patientId),
        document_id: Number(documentId),
        purpose: purpose.trim(),
      });

      setSuccess('Access request submitted successfully!');
      setPatientId('');
      setDocumentId('');
      setPurpose('');

      await loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Download an approved redacted medical document
  const handleDownload = async (requestId) => {
    setError('');
    setSuccess('');

    try {
      setDownloadingId(requestId);

      const blob = await sharingApi.fetchSharedDocument(requestId);

      const fileUrl = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');

      downloadLink.href = fileUrl;
      downloadLink.download = `redacted_document_request_${requestId}.pdf`;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      window.URL.revokeObjectURL(fileUrl);

      setSuccess('Redacted document downloaded successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="container dashboard-page">

      <div className="welcome-banner card">
        <div className="banner-content">
          <span className="banner-badge">
            👨‍⚕️ Healthcare Provider Portal
          </span>
          <h1>Provider Dashboard</h1>
          <p className="banner-subtitle">
            Request access to patient medical documents with patient consent.
          </p>
        </div>
      </div>

      {/* Request Patient Document Access */}
      <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
        <h2>Request Patient Document Access</h2>
        <p className="text-muted">
          Submit a request explaining why you need access to a patient's document.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="patientId">Patient ID</label>
            <input
              id="patientId"
              type="number"
              min="1"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Enter patient ID"
              required
              style={{ width: '100%', padding: '10px', marginTop: '6px' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="documentId">Document ID</label>
            <input
              id="documentId"
              type="number"
              min="1"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="Enter document ID"
              required
              style={{ width: '100%', padding: '10px', marginTop: '6px' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="purpose">Purpose of Access</label>
            <textarea
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Explain why you need this document..."
              minLength={5}
              maxLength={1000}
              required
              rows={4}
              style={{ width: '100%', padding: '10px', marginTop: '6px' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Access Request'}
          </button>
        </form>

        {error && (
          <p role="alert" style={{ color: 'red', marginTop: '16px' }}>
            {error}
          </p>
        )}

        {success && (
          <p role="status" style={{ color: 'green', marginTop: '16px' }}>
            {success}
          </p>
        )}
      </div>

      {/* Provider Access Request History */}
      <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
        <h2>My Access Requests</h2>
        <p className="text-muted">
          Track request status and download documents approved by patients.
        </p>

        {loading ? (
          <p>Loading requests...</p>
        ) : requests.length === 0 ? (
          <p>No access requests submitted yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Patient ID</th>
                  <th>Document ID</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.patient_id}</td>
                    <td>{item.document_id}</td>
                    <td>{item.purpose}</td>
                    <td>{item.status}</td>

                    <td>
                      {item.expires_at
                        ? new Date(item.expires_at).toLocaleString()
                        : 'N/A'}
                    </td>

                    <td>
                      {item.status === 'Approved' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={downloadingId === item.id}
                          onClick={() => handleDownload(item.id)}
                        >
                          {downloadingId === item.id
                            ? 'Downloading...'
                            : 'Download PDF'}
                        </button>
                      ) : (
                        'Not available'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
