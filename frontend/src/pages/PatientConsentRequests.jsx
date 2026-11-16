import { useEffect, useState } from 'react';
import { sharingApi } from '../services/api';
import { useToast } from '../context/useToast';

function getDefaultExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return localDate.toISOString().slice(0, 16);
}

export default function PatientConsentRequests() {
  const { showToast } = useToast();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [expiry, setExpiry] = useState(getDefaultExpiry);
  const [minDateTime] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
  );

  const loadRequests = async () => {
    try {
      setError('');
      const data = await sharingApi.getPatientRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    sharingApi.getPatientRequests()
      .then((data) => {
        if (!ignore) {
          setRequests(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || 'Failed to load requests.');
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleDecision = async (requestId, status) => {
    setError('');
    setMessage('');

    const decisionData = { status };

    if (status === 'Approved') {
      if (!expiry || expiry <= minDateTime) {
        const errText = 'Please select a future expiry date and time.';
        setError(errText);
        showToast(errText, 'warning');
        return;
      }
      decisionData.expires_at = new Date(expiry).toISOString();
      decisionData.decision_note = 'Approved by patient with explicit time-bound consent.';
    } else {
      decisionData.decision_note = 'Access request rejected by patient.';
    }

    try {
      setProcessingId(requestId);
      await sharingApi.decideRequest(requestId, decisionData);
      const okMsg = `Request #${requestId} was ${status.toLowerCase()} successfully.`;
      setMessage(okMsg);
      showToast(okMsg, status === 'Approved' ? 'success' : 'info');
      await loadRequests();
    } catch (err) {
      const errMsg = err.message || 'Failed to update request.';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'Pending');

  return (
    <div className="card" style={{ padding: '1.75rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: '700' }}>
            Healthcare Provider Access Requests
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.885rem' }}>
            Review incoming requests from doctors and clinicians to view your redacted medical records. You control expiry and access.
          </p>
        </div>
        <button
          type="button"
          onClick={loadRequests}
          className="btn btn-outline btn-sm"
          disabled={loading}
        >
          🔄 Refresh Requests
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="alert alert-success" role="status">
          <span className="alert-icon">✓</span>
          <span>{message}</span>
        </div>
      )}

      {/* Expiry Selector Config */}
      {pendingRequests.length > 0 && (
        <div className="card-subtle" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
              ⏱️ Default Consent Validity Period
            </span>
            <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
              Set when approved access expires automatically
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="datetime-local"
              className="form-control"
              min={minDateTime}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.875rem' }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Checking for pending access requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🤝</span>
          <strong style={{ color: 'var(--text-primary)' }}>No provider access requests right now.</strong>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
            When a clinician requests access to one of your medical files, it will appear here for your review and authorization.
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Provider / Clinician</th>
                <th>Requested Document</th>
                <th>Clinical Purpose</th>
                <th>Status</th>
                <th>Expires</th>
                <th style={{ textAlign: 'right' }}>Patient Decision</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td><strong>#{req.id}</strong></td>
                  <td>Provider #{req.provider_id}</td>
                  <td>Document #{req.document_id}</td>
                  <td style={{ maxWidth: '240px', wordBreak: 'break-word' }}>
                    {req.purpose}
                  </td>
                  <td>
                    {req.status === 'Approved' ? (
                      <span className="badge badge-green">✓ Approved</span>
                    ) : req.status === 'Pending' ? (
                      <span className="badge badge-amber">⏳ Pending</span>
                    ) : (
                      <span className="badge badge-neutral">✕ {req.status}</span>
                    )}
                  </td>
                  <td>
                    {req.expires_at ? (
                      <span style={{ fontSize: '0.85rem' }}>
                        {new Date(req.expires_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {req.status === 'Pending' ? (
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={processingId === req.id}
                          onClick={() => handleDecision(req.id, 'Approved')}
                        >
                          {processingId === req.id ? 'Saving...' : '✓ Approve'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-outline btn-sm"
                          disabled={processingId === req.id}
                          onClick={() => handleDecision(req.id, 'Rejected')}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                        Resolved
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
  );
}
