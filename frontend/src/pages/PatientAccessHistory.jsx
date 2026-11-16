import { useEffect, useState, useCallback } from 'react';
import api, { sharingApi } from '../services/api';

export default function PatientAccessHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadHistory = useCallback(async () => {
    setIsRefreshing(true);
    setError('');
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.append('search', searchTerm.trim());
    if (actionFilter !== 'all') params.append('action', actionFilter);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    try {
      let data = [];
      try {
        const res = await api.get(`/api/audit/${queryString}`);
        data = res?.data || res || [];
      } catch {
        data = await sharingApi.getPatientAuditHistory();
      }
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load access history.');
    } finally {
      setIsRefreshing(false);
    }
  }, [searchTerm, actionFilter, statusFilter]);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.append('search', searchTerm.trim());
    if (actionFilter !== 'all') params.append('action', actionFilter);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    const queryString = params.toString() ? `?${params.toString()}` : '';

    api.get(`/api/audit/${queryString}`)
      .then((res) => {
        if (!ignore) {
          const data = res?.data || res || [];
          setHistory(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        // Fallback to sharing audit endpoint
        return sharingApi.getPatientAuditHistory().then((data) => {
          if (!ignore) {
            setHistory(Array.isArray(data) ? data : []);
            setLoading(false);
          }
        });
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || 'Unable to load access history.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [searchTerm, actionFilter, statusFilter]);

  const formatActionName = (action) => {
    switch (action) {
      case 'ACCESS_REQUESTED':
        return 'Access Requested';
      case 'CONSENT_APPROVED':
        return 'Consent Approved';
      case 'CONSENT_REJECTED':
        return 'Consent Rejected';
      case 'DOCUMENT_ACCESS_GRANTED':
        return 'Record Downloaded';
      case 'DOCUMENT_ACCESS_DENIED':
        return 'Access Blocked';
      default:
        return action?.replace(/_/g, ' ') || 'Activity Log';
    }
  };

  return (
    <div className="card" style={{ padding: '1.75rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: '700' }}>
            Data Access & Disclosure Audit History
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.885rem' }}>
            Permanent, tamper-evident audit records of all provider access attempts, approvals, rejections, and downloads of your medical files.
          </p>
        </div>
        <button
          type="button"
          onClick={loadHistory}
          className="btn btn-outline btn-sm"
          disabled={loading || isRefreshing}
        >
          🔄 Refresh Logs
        </button>
      </div>

      {/* Search & Filters */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search logs by provider, document, or purpose..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="form-control"
          style={{ width: 'auto', minWidth: '170px' }}
        >
          <option value="all">All Actions</option>
          <option value="ACCESS_REQUESTED">Access Requested</option>
          <option value="CONSENT_APPROVED">Consent Approved</option>
          <option value="CONSENT_REJECTED">Consent Rejected</option>
          <option value="DOCUMENT_ACCESS_GRANTED">Record Downloaded</option>
          <option value="DOCUMENT_ACCESS_DENIED">Access Blocked</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="form-control"
          style={{ width: 'auto', minWidth: '150px' }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active / Approved</option>
          <option value="denied">Denied / Rejected</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading real-time audit history...</p>
        </div>
      ) : history.length === 0 ? (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📋</span>
          <strong style={{ color: 'var(--text-primary)' }}>No access activities recorded yet.</strong>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
            Every request, authorization, rejection, or download is logged here with cryptographic timestamps.
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action / Activity</th>
                <th>Provider / Institution</th>
                <th>Target Document</th>
                <th>Clinical Purpose / Note</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const actionName = item.action || 'ACCESS_ATTEMPT';
                const isSuccess =
                  item.success === true ||
                  item.consent_status === 'active' ||
                  item.consent_status === 'Approved' ||
                  actionName === 'CONSENT_APPROVED' ||
                  actionName === 'DOCUMENT_ACCESS_GRANTED';

                const timeStr = item.access_time || item.created_at;

                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>
                          {actionName.includes('GRANTED') || actionName.includes('APPROVED')
                            ? '✅'
                            : actionName.includes('DENIED') || actionName.includes('REJECTED')
                            ? '🚫'
                            : '📝'}
                        </span>
                        <strong>{formatActionName(actionName)}</strong>
                      </div>
                    </td>
                    <td>
                      {item.provider_name
                        ? item.provider_name
                        : item.institution_id
                        ? item.institution_id
                        : item.provider_id
                        ? `Provider #${item.provider_id}`
                        : item.actor_id
                        ? `User #${item.actor_id}`
                        : 'System Service'}
                    </td>
                    <td>
                      {item.document_name
                        ? item.document_name
                        : item.document_id
                        ? `Document #${item.document_id}`
                        : 'General Portal'}
                    </td>
                    <td style={{ maxWidth: '240px', wordBreak: 'break-word' }}>
                      {item.purpose || item.details || item.decision_note || 'Direct Access Request'}
                    </td>
                    <td>
                      {isSuccess ? (
                        <span className="badge badge-green">✓ Authorized</span>
                      ) : (
                        <span className="badge badge-neutral">✕ {item.consent_status || 'Denied'}</span>
                      )}
                    </td>
                    <td>
                      {timeStr ? (
                        <span style={{ fontSize: '0.825rem', whiteSpace: 'nowrap' }}>
                          {new Date(timeStr).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : (
                        'Just now'
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
  );
}
