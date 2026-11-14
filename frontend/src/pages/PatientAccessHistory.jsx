
import { useEffect, useState } from 'react';
import { sharingApi } from '../services/api';

export default function PatientAccessHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await sharingApi.getPatientAuditHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load access history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <section style={{
      marginTop: '24px',
      padding: '24px',
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px'
    }}>
      <h2 style={{ marginTop: 0 }}>Document Access History</h2>

      <p style={{ color: '#64748b' }}>
        Review recorded activities involving access to your medical documents.
      </p>

      {loading && <p>Loading access history...</p>}

      {error && (
        <div>
          <p style={{ color: '#dc2626' }}>{error}</p>
          <button onClick={loadHistory}>Try Again</button>
        </div>
      )}

      {!loading && !error && history.length === 0 && (
        <p>No access history is available yet.</p>
      )}

      {!loading && !error && history.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left'
          }}>
            <thead>
              <tr>
                <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Activity</th>
                <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Provider ID</th>
                <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Document ID</th>
                <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Result</th>
                <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Date and Time</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                    {item.action}
                  </td>

                  <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                    {item.provider_id}
                  </td>

                  <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                    {item.document_id ?? 'N/A'}
                  </td>

                  <td style={{
                    padding: '12px',
                    borderBottom: '1px solid #e5e7eb',
                    color: item.success ? '#15803d' : '#dc2626'
                  }}>
                    {item.success ? 'Successful' : 'Unsuccessful'}
                  </td>

                  <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
