import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import DocumentManager from '../components/DocumentManager';
import ProviderDashboard from './ProviderDashboard';
import PatientConsentRequests from './PatientConsentRequests';
import ConsentManager from '../components/consent/consentmanager';
import PatientAccessHistory from './PatientAccessHistory';
import RedactionPage from '../redaction/RedactionPage';
import api, { documentApi, sharingApi } from '../services/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('documents');
  const [redactionTargetDocId, setRedactionTargetDocId] = useState(null);

  // Quick stats
  const [docCount, setDocCount] = useState(0);
  const [pendingReqCount, setPendingReqCount] = useState(0);
  const [consentCount, setConsentCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let ignore = false;
    if (user?.role?.toLowerCase() === 'patient') {
      const p1 = documentApi.listDocuments()
        .then((docs) => {
          if (!ignore && Array.isArray(docs)) setDocCount(docs.length);
        })
        .catch(() => {});

      const p2 = sharingApi.getPatientRequests()
        .then((reqs) => {
          if (!ignore && Array.isArray(reqs)) {
            const pending = reqs.filter((r) => r.status === 'Pending').length;
            setPendingReqCount(pending);
          }
        })
        .catch(() => {});

      const p3 = api.get('/api/consent/')
        .then((res) => {
          if (!ignore) {
            const data = res?.data || res || [];
            if (Array.isArray(data)) setConsentCount(data.filter((c) => c.status === 'active').length);
          }
        })
        .catch(() => {});

      Promise.allSettled([p1, p2, p3]).finally(() => {
        if (!ignore) setLoadingStats(false);
      });
    }
    return () => {
      ignore = true;
    };
  }, [user]);

  if (!user) return null;

  // Render Provider Portal when logged in as provider
  if (user.role?.toLowerCase() === 'provider') {
    return <ProviderDashboard />;
  }

  const profile = user.patient_profile;

  const handleSelectForRedaction = (docId) => {
    setRedactionTargetDocId(docId);
    setActiveTab('redaction');
  };

  return (
    <div className="container dashboard-page">
      {/* Top Healthcare Dashboard Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <div className="dashboard-badge-pill">
            <span>🛡️</span> MyMedData Privacy Platform
          </div>
          <h1>Welcome, {user.full_name}</h1>
          <p className="dashboard-subtitle">
            Manage your medical records, redact sensitive personal details, and grant time-bound consent.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="dashboard-status-tag">
            <span className="status-dot"></span>
            <span>Active Patient #{user.id}</span>
          </div>
          <Link to="/profile" className="btn btn-outline btn-sm">
            👤 View Profile
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div
          className="metric-card"
          onClick={() => setActiveTab('documents')}
          style={{ cursor: 'pointer' }}
          title="Click to view documents"
        >
          <div className="metric-icon-box metric-icon-blue">
            📁
          </div>
          <div className="metric-info">
            <span className="metric-label">Medical Records</span>
            <div className="metric-value">
              {loadingStats ? <div className="skeleton" style={{ width: '40px', height: '24px' }} /> : docCount}
            </div>
            <span className="metric-sub">Encrypted in vault</span>
          </div>
        </div>

        <div
          className="metric-card"
          onClick={() => setActiveTab('consent')}
          style={{ cursor: 'pointer' }}
          title="Click to review consent requests"
        >
          <div className="metric-icon-box metric-icon-amber">
            ⏳
          </div>
          <div className="metric-info">
            <span className="metric-label">Access Requests</span>
            <div className="metric-value">
              {loadingStats ? <div className="skeleton" style={{ width: '40px', height: '24px' }} /> : pendingReqCount}
            </div>
            <span className="metric-sub" style={{ color: pendingReqCount > 0 ? 'var(--warning-text)' : 'var(--text-muted)' }}>
              {pendingReqCount > 0 ? `${pendingReqCount} requires review` : 'All resolved'}
            </span>
          </div>
        </div>

        <div
          className="metric-card"
          onClick={() => setActiveTab('consent')}
          style={{ cursor: 'pointer' }}
          title="Click to manage active consents"
        >
          <div className="metric-icon-box metric-icon-green">
            🤝
          </div>
          <div className="metric-info">
            <span className="metric-label">Active Consents</span>
            <div className="metric-value">
              {loadingStats ? <div className="skeleton" style={{ width: '40px', height: '24px' }} /> : consentCount}
            </div>
            <span className="metric-sub">Authorized institutions</span>
          </div>
        </div>

        <div
          className="metric-card"
          onClick={() => setActiveTab('profile')}
          style={{ cursor: 'pointer' }}
          title="Click to view medical profile"
        >
          <div className="metric-icon-box metric-icon-purple">
            🩸
          </div>
          <div className="metric-info">
            <span className="metric-label">Blood Group</span>
            <div className="metric-value">
              {profile?.blood_group || 'N/A'}
            </div>
            <span className="metric-sub">Verified attribute</span>
          </div>
        </div>
      </div>

      {/* Modern SaaS Navigation Tabs */}
      <div className="dashboard-nav-bar" role="tablist" aria-label="Dashboard Sections">
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`dashboard-nav-btn ${activeTab === 'documents' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'documents'}
        >
          <span>📁</span> Medical Documents
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('redaction')}
          className={`dashboard-nav-btn ${activeTab === 'redaction' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'redaction'}
        >
          <span>🛡️</span> Redaction Studio
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('consent')}
          className={`dashboard-nav-btn ${activeTab === 'consent' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'consent'}
        >
          <span>🤝</span> Consent Management
          {pendingReqCount > 0 && (
            <span className="nav-badge-pill">
              {pendingReqCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`dashboard-nav-btn ${activeTab === 'audit' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'audit'}
        >
          <span>📋</span> Access Audit Trail
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`dashboard-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'profile'}
        >
          <span>👤</span> Health Profile Summary
        </button>
      </div>

      {/* Tab 1: Medical Documents */}
      {activeTab === 'documents' && (
        <DocumentManager onSelectForRedaction={handleSelectForRedaction} />
      )}

      {/* Tab 2: PII Redaction Studio */}
      {activeTab === 'redaction' && (
        <RedactionPage key={redactionTargetDocId || 'none'} preselectedDocId={redactionTargetDocId} />
      )}

      {/* Tab 3: Consent & Permissions */}
      {activeTab === 'consent' && (
        <div>
          <PatientConsentRequests />
          <ConsentManager />
        </div>
      )}

      {/* Tab 4: Access History & Audit Trail */}
      {activeTab === 'audit' && (
        <PatientAccessHistory />
      )}

      {/* Tab 5: Health Profile Summary */}
      {activeTab === 'profile' && (
        <div className="card" style={{ padding: '1.75rem', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: '700' }}>
                Personal Health Profile Summary
              </h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.885rem' }}>
                Your demographic and emergency contact attributes stored under zero-trust database encryption.
              </p>
            </div>
            <Link to="/profile" className="btn btn-primary btn-sm">
              ✏️ Edit Full Profile
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="card-subtle">
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Full Legal Name</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.985rem' }}>{user.full_name}</strong>
            </div>

            <div className="card-subtle">
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Email Address</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.985rem' }}>{user.email}</strong>
            </div>

            <div className="card-subtle">
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Phone Number</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.985rem' }}>{profile?.phone_number || 'Not provided'}</strong>
            </div>

            <div className="card-subtle">
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Blood Group</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.985rem' }}>{profile?.blood_group || 'Not specified'}</strong>
            </div>

            <div className="card-subtle">
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Date of Birth</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.985rem' }}>{profile?.date_of_birth || 'Not provided'}</strong>
            </div>

            <div className="card-subtle">
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Emergency Contact</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.985rem' }}>
                {profile?.emergency_contact_name
                  ? `${profile.emergency_contact_name} (${profile.emergency_contact_phone || 'No phone'})`
                  : 'None listed'}
              </strong>
            </div>
          </div>

          <div className="card-subtle" style={{ marginTop: '1rem' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Known Allergies & Clinical History</span>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.925rem' }}>
              {profile?.allergies || 'No known allergies reported.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
