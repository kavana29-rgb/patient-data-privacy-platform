
import { useEffect, useState } from 'react';
import { sharingApi } from '../services/api';

function getDefaultExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + 7);

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 16);
}

export default function PatientConsentRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [expiry, setExpiry] = useState(getDefaultExpiry);

  const loadRequests = async () => {
    try {
      setError('');

      const data = await sharingApi.getPatientRequests();
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

  const handleDecision = async (requestId, status) => {
    setError('');
    setMessage('');

    const decisionData = { status };

    if (status === 'Approved') {
      if (!expiry || new Date(expiry).getTime() <= Date.now()) {
        setError('Please select a future expiry date and time.');
        return;
      }

      decisionData.expires_at = new Date(expiry).toISOString();
      decisionData.decision_note = 'Approved by patient.';
    } else {
      decisionData.decision_note = 'Rejected by patient.';
    }

    try {
      setProcessingId(requestId);

      await sharingApi.decideRequest(requestId, decisionData);

      setMessage(
        `Request #${requestId} ${status.toLowerCase()} successfully.`
      );

      await loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
      <h2>Patient Consent Requests</h2>

      <p className="text-muted">
        Review provider requests and decide whether to share your documents.
        You choose how long approved access remains valid.
      </p>

      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      {message && (
        <p role="status" style={{ color: 'green' }}>
          {message}
        </p>
      )}

      {loading ? (
        <p>Loading consent requests...</p>
      ) : requests.length === 0 ? (
        <p>No provider access requests yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Provider ID</th>
                <th>Document ID</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Expiry Date &amp; Time</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.provider_id}</td>
                  <td>{item.document_id}</td>
                  <td>{item.purpose}</td>
                  <td>{item.status}</td>

                  <td>
                    {item.status === 'Pending' ? (
                      <input
                        type="datetime-local"
                        value={expiry}
                        min={new Date(
                          Date.now() -
                            new Date().getTimezoneOffset() * 60000
                        )
                          .toISOString()
                          .slice(0, 16)}
                        onChange={(e) => setExpiry(e.target.value)}
                      />
                    ) : (
                      item.expires_at
                        ? new Date(item.expires_at).toLocaleString()
                        : 'Not applicable'
                    )}
                  </td>

                  <td>
                    {item.status === 'Pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={processingId === item.id}
                          onClick={() =>
                            handleDecision(item.id, 'Approved')
                          }
                        >
                          {processingId === item.id
                            ? 'Processing...'
                            : 'Approve'}
                        </button>

                        {' '}

                        <button
                          type="button"
                          disabled={processingId === item.id}
                          onClick={() =>
                            handleDecision(item.id, 'Rejected')
                          }
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      'No action available'
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
