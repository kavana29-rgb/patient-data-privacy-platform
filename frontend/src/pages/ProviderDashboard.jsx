import { useEffect, useState } from 'react';
import { sharingApi } from '../services/api';
import { useToast } from '../context/useToast';

export default function ProviderDashboard() {
  const { showToast } = useToast();

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
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch access requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    sharingApi.getProviderRequests()
      .then((data) => {
        if (!ignore) {
          setRequests(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || 'Failed to fetch access requests.');
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Submit a new patient document access request
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!patientId || !documentId || !purpose.trim()) {
      setError('Please complete all access request fields.');
      return;
    }

    try {
      setSubmitting(true);
      await sharingApi.createRequest({
        patient_id: Number(patientId),
        document_id: Number(documentId),
        purpose: purpose.trim(),
      });

      const successMsg = 'Access request submitted to patient for authorization.';
      setSuccess(successMsg);
      showToast(successMsg, 'success');
      setPatientId('');
      setDocumentId('');
      setPurpose('');
      await loadRequests();
    } catch (err) {
      const msg = err.message || 'Failed to submit request.';
      setError(msg);
      showToast(msg, 'error');
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
      showToast('Preparing authorized redacted PDF...', 'info');

      const blob = await sharingApi.fetchSharedDocument(requestId);
      const fileUrl = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');

      downloadLink.href = fileUrl;
      downloadLink.download = `authorized_redacted_doc_req_${requestId}.pdf`;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      window.URL.revokeObjectURL(fileUrl);
      showToast('Downloaded authorized redacted record.', 'success');
    } catch (err) {
      const msg = err.message || 'Download failed or access expired.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const approvedCount = requests.filter((r) => r.status === 'Approved').length;
  const pendingCount = requests.filter((r) => r.status === 'Pending').length;

  return (
    <div className="container dashboard-page">
      {/* Top Clinical Header */}
      <div className="dashboard-header" style={{ borderLeft: '4px solid var(--secondary)' }}>
        <div className="dashboard-title-group">
          <div className="dashboard-badge-pill" style={{ backgroundColor: 'var(--secondary-light)', color: 'var(--secondary)' }}>
            <span>👨‍⚕️</span> Healthcare Provider Clinical Portal
          </div>
          <h1>Clinician Access & Patient Records</h1>
          <p className="dashboard-subtitle">
            Request time-bound access to patient medical documents. All records are sanitized according to patient redaction preferences.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="dashboard-status-tag">
            <span className="status-dot" style={{ backgroundColor: 'var(--secondary)' }}></span>
            <span>Verified Clinician Access</span>
          </div>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box metric-icon-green">
            ✓
          </div>
          <div className="metric-info">
            <span className="metric-label">Approved Records</span>
            <div className="metric-value">{approvedCount}</div>
            <span className="metric-sub">Accessible with valid consent</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-icon-amber">
            ⏳
          </div>
          <div className="metric-info">
            <span className="metric-label">Pending Authorizations</span>
            <div className="metric-value">{pendingCount}</div>
            <span className="metric-sub">Awaiting patient decision</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-icon-blue">
            📋
          </div>
          <div className="metric-info">
            <span className="metric-label">Total Requests</span>
            <div className="metric-value">{requests.length}</div>
            <span className="metric-sub">Submitted requests</span>
          </div>
        </div>
      </div>

      {/* Request Patient Document Access Form */}
      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: '700' }}>
            Request Patient Record Access
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.885rem' }}>
            Submit an explicit clinical access request. The patient will be notified to review and grant time-bound consent.
          </p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="status">
            <span className="alert-icon">✓</span>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="patientId">Target Patient ID *</label>
              <input
                id="patientId"
                type="number"
                min="1"
                className="form-control"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="e.g. 5"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="documentId">Document ID *</label>
              <input
                id="documentId"
                type="number"
                min="1"
                className="form-control"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="e.g. 1"
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="purpose">Clinical Purpose of Access *</label>
            <textarea
              id="purpose"
              className="form-control"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="State clinical reason (e.g., Follow-up consultation for respiratory symptoms)..."
              minLength={5}
              maxLength={1000}
              required
              rows={3}
              disabled={submitting}
            />
            <span className="form-hint">
              This reason is recorded in the immutable audit log and shown to the patient.
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner-sm"></span> Submitting Request...
              </>
            ) : (
              '📤 Submit Access Request'
            )}
          </button>
        </form>
      </div>

      {/* Provider Access Request History */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: '700' }}>
              My Access Requests & Consents
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.885rem' }}>
              Status of your document requests. Approved records can be downloaded immediately.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadRequests}
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
            <strong style={{ color: 'var(--text-primary)' }}>No access requests submitted yet.</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
              Use the form above to request access to a patient's medical records.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Patient ID</th>
                  <th>Document ID</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Consent Expiry</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td><strong>#{item.id}</strong></td>
                    <td>Patient #{item.patient_id}</td>
                    <td>Document #{item.document_id}</td>
                    <td style={{ maxWidth: '240px', wordBreak: 'break-word' }}>{item.purpose}</td>
                    <td>
                      {item.status === 'Approved' ? (
                        <span className="badge badge-green">✓ Approved</span>
                      ) : item.status === 'Pending' ? (
                        <span className="badge badge-amber">⏳ Pending</span>
                      ) : (
                        <span className="badge badge-neutral">✕ {item.status}</span>
                      )}
                    </td>
                    <td>
                      {item.expires_at ? (
                        <span style={{ fontSize: '0.85rem' }}>
                          {new Date(item.expires_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {item.status === 'Approved' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={downloadingId === item.id}
                          onClick={() => handleDownload(item.id)}
                        >
                          {downloadingId === item.id ? (
                            <>
                              <span className="spinner-sm"></span> Downloading...
                            </>
                          ) : (
                            '📥 Download PDF'
                          )}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                          {item.status === 'Pending' ? 'Awaiting Patient' : 'No Access'}
                        </span>
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
