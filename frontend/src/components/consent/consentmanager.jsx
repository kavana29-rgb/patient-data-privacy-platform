import { useState, useEffect, useCallback } from 'react';
import api, { documentApi } from '../../services/api';
import { useToast } from '../../context/useToast';

export default function ConsentManager() {
  const { showToast } = useToast();

  const [consents, setConsents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState({
    institution_id: '',
    document_id: '',
    purpose: '',
    expiry_date: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  // Revocation Confirmation Modal State
  const [consentToRevoke, setConsentToRevoke] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  const fetchConsents = useCallback(async () => {
    try {
      const res = await api.get('/api/consent/');
      const data = res?.data || res || [];
      setConsents(Array.isArray(data) ? data : []);
    } catch {
      setError('Unable to load institution consents.');
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await documentApi.listDocuments();
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch {
      // Background fetch
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    api.get('/api/consent/')
      .then((res) => {
        if (!ignore) {
          const data = res?.data || res || [];
          setConsents(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError('Unable to load institution consents.');
        }
      });

    documentApi.listDocuments()
      .then((docs) => {
        if (!ignore) {
          setDocuments(Array.isArray(docs) ? docs : []);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  const handleGrant = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.institution_id || !form.document_id || !form.purpose || !form.expiry_date) {
      setError('Please fill in all consent fields.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/consent/', {
        ...form,
        document_id: parseInt(form.document_id, 10),
        expiry_date: new Date(form.expiry_date).toISOString(),
      });

      const okMsg = `Direct access permission granted to ${form.institution_id}.`;
      setSuccess(okMsg);
      showToast(okMsg, 'success');
      setForm({ institution_id: '', document_id: '', purpose: '', expiry_date: '' });
      await fetchConsents();
      await fetchDocuments();
    } catch (err) {
      const errMsg = err?.message || 'Failed to grant consent.';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmRevoke = async () => {
    if (!consentToRevoke) return;

    setError(null);
    setSuccess(null);
    try {
      setRevokingId(consentToRevoke.id);
      await api.patch(`/api/consent/${consentToRevoke.id}/revoke`);
      const okMsg = `Consent #${consentToRevoke.id} for "${consentToRevoke.institution_id}" was revoked.`;
      setSuccess(okMsg);
      showToast(okMsg, 'success');
      setConsentToRevoke(null);
      await fetchConsents();
    } catch (err) {
      const errMsg = err?.message || 'Failed to revoke consent.';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="card" style={{ padding: '1.75rem', marginTop: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: '700' }}>
          Direct Institution Consent Rules
        </h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.885rem' }}>
          Pre-authorize designated healthcare organizations, research institutions, or hospitals to access specific records with strict expiration dates.
        </p>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="status" style={{ marginBottom: '1rem' }}>
          <span className="alert-icon">✓</span>
          <span>{success}</span>
        </div>
      )}

      {/* Grant Access Form */}
      <form onSubmit={handleGrant} className="card-subtle" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '600' }}>
          ➕ Authorize New Institution Access
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Institution / Hospital Name *
            </label>
            <input
              type="text"
              value={form.institution_id}
              onChange={(e) => setForm({ ...form, institution_id: e.target.value })}
              placeholder="e.g. Apollo Diagnostics"
              required
              className="form-control"
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Select Medical Document *
            </label>
            <select
              value={form.document_id}
              onChange={(e) => setForm({ ...form, document_id: e.target.value })}
              required
              className="form-control"
              disabled={loading}
            >
              <option value="">-- Choose Document --</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.filename} (ID: #{doc.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Purpose of Disclosure *
            </label>
            <input
              type="text"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="e.g. Second opinion"
              required
              className="form-control"
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Consent Expiration Date *
            </label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              required
              className="form-control"
              disabled={loading}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-sm"></span> Granting Access...
            </>
          ) : (
            'Grant Institution Access'
          )}
        </button>
      </form>

      {/* Active & Revoked Consents List */}
      <div>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '600' }}>
          Active & Historical Consents
        </h3>

        {consents.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.35rem' }}>📋</span>
            <strong>No direct institution consents configured.</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
              Use the form above to grant time-limited access to a hospital or clinical provider.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Consent ID</th>
                  <th>Healthcare Institution</th>
                  <th>Document ID</th>
                  <th>Purpose</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((consent) => {
                  const isRevoked = consent.status === 'revoked';
                  const isExpired = new Date(consent.expiry_date) < new Date();
                  const effectiveStatus = isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active';

                  return (
                    <tr key={consent.id}>
                      <td><strong>#{consent.id}</strong></td>
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>{consent.institution_id}</strong>
                      </td>
                      <td>Document #{consent.document_id}</td>
                      <td style={{ maxWidth: '220px', wordBreak: 'break-word' }}>{consent.purpose}</td>
                      <td>
                        {consent.expiry_date
                          ? new Date(consent.expiry_date).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </td>
                      <td>
                        {effectiveStatus === 'Active' ? (
                          <span className="badge badge-green">✓ Active</span>
                        ) : effectiveStatus === 'Revoked' ? (
                          <span className="badge badge-neutral">✕ Revoked</span>
                        ) : (
                          <span className="badge badge-amber">⏱️ Expired</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {effectiveStatus === 'Active' ? (
                          <button
                            type="button"
                            className="btn btn-danger-outline btn-sm"
                            disabled={revokingId === consent.id}
                            onClick={() => setConsentToRevoke(consent)}
                          >
                            Revoke Consent
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                            No action
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revocation Confirmation Dialog */}
      {consentToRevoke && (
        <div className="modal-overlay" onClick={() => !revokingId && setConsentToRevoke(null)}>
          <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottomColor: 'var(--error-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem', color: 'var(--error)' }}>⚠️</span>
                <h3 style={{ color: 'var(--error)', margin: 0 }}>Confirm Revocation</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !revokingId && setConsentToRevoke(null)}
                disabled={revokingId}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: '0 0 0.5rem 0' }}>
                Are you sure you want to revoke consent for:
              </p>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{consentToRevoke.institution_id}</div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Document #{consentToRevoke.document_id} &bull; {consentToRevoke.purpose}</div>
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                This will immediately terminate their ability to access or download this record.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setConsentToRevoke(null)}
                disabled={revokingId}
              >
                Keep Consent
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={confirmRevoke}
                disabled={revokingId}
              >
                {revokingId ? 'Revoking...' : 'Yes, Revoke Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
