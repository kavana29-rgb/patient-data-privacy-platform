
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import DocumentManager from '../components/DocumentManager';
import ProviderDashboard from './ProviderDashboard';
import PatientConsentRequests from './PatientConsentRequests';
import PatientAccessHistory from './PatientAccessHistory';

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === 'provider') {
    return <ProviderDashboard />;
  }

  const isPatient = user.role === 'patient';
  const profile = user.patient_profile;

  return (
    <div className="dashboard-page container">
      {/* Welcome Banner */}
      <div className="welcome-banner card">
        <div className="banner-content">
          <span className="banner-badge">
            {isPatient ? '🛡️ Patient Privacy Portal' : '👨‍⚕️ Clinician Access Center'}
          </span>
          <h1>Welcome, {user.full_name}</h1>
          <p className="banner-subtitle">
            Your patient-centric health records and privacy rights are managed under strict zero-trust role-based access control.
          </p>
        </div>
        <div className="banner-status">
          <div className="status-pill status-active">
            <span className="dot"></span>
            Account Status: Active
          </div>
          <span className="status-sub">Authenticated via Secure JWT</span>
        </div>
      </div>

      {/* Security & Overview Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card card">
          <div className="stat-icon-wrapper blue">🔐</div>
          <div className="stat-info">
            <span className="stat-label">Access Control</span>
            <span className="stat-value">Patient Self-Governed</span>
            <span className="stat-hint">Role verified by backend token validation</span>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon-wrapper teal">🛡️</div>
          <div className="stat-info">
            <span className="stat-label">Privacy Standard</span>
            <span className="stat-value">HIPAA & GDPR Ready</span>
            <span className="stat-hint">Cryptographic zero-exposure architecture</span>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon-wrapper green">🏥</div>
          <div className="stat-info">
            <span className="stat-label">System Identity</span>
            <span className="stat-value">{user.email}</span>
            <span className="stat-hint">User ID: #{user.id}</span>
          </div>
        </div>
      </div>

      {/* Patient Profile Summary */}
      {isPatient && (
        <div className="profile-summary-section card">
          <div className="section-header-flex">
            <div>
              <h2>Personal Health Profile</h2>
              <p className="text-muted">
                Your basic medical attributes and emergency contacts. Managed directly by you.
              </p>
            </div>
            <Link to="/profile" className="btn btn-primary">
              ✏️ Manage Profile
            </Link>
          </div>

          <div className="profile-data-preview">
            <div className="preview-item">
              <span className="preview-label">Blood Group</span>
              <span className="preview-value badge badge-blue">
                {profile?.blood_group || 'Not specified'}
              </span>
            </div>

            <div className="preview-item">
              <span className="preview-label">Phone</span>
              <span className="preview-value">
                {profile?.phone_number || 'Not provided'}
              </span>
            </div>

            <div className="preview-item">
              <span className="preview-label">Date of Birth</span>
              <span className="preview-value">
                {profile?.date_of_birth || 'Not provided'}
              </span>
            </div>

            <div className="preview-item">
              <span className="preview-label">Emergency Contact</span>
              <span className="preview-value">
                {profile?.emergency_contact_name ? (
                  <span>
                    {profile.emergency_contact_name}{' '}
                    {profile.emergency_contact_phone && `(${profile.emergency_contact_phone})`}
                  </span>
                ) : (
                  'None listed'
                )}
              </span>
            </div>

            <div className="preview-item full-width">
              <span className="preview-label">Known Allergies</span>
              <span className="preview-value">
                {profile?.allergies || 'No known allergies reported'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Module B: Medical Document Management */}
      {isPatient && (
        <div id="document-vault-section">
          <DocumentManager />
        </div>
      )}

      {/* Module E: Provider Consent Requests */}
      {isPatient && <PatientConsentRequests />}

      {/* Module E: Patient Document Access History */}
      {isPatient && <PatientAccessHistory />}

      {/* Navigation Placeholders for Teammates' Modules */}
      <div className="modules-section">
        <div className="section-title-wrap">
          <h2>Platform Modules & Services</h2>
          <p className="text-muted">
            The Patient Data Privacy Platform is modular. Other specialized modules are assigned to respective team members.
          </p>
        </div>

        <div className="module-grid">
          {/* Module B */}
          <div className="module-card card">
            <div className="module-card-header">
              <div className="module-icon">📁</div>
              <span className="module-badge badge-blue">Module B — Active</span>
            </div>
            <h3>Medical Documents</h3>
            <p className="module-desc">
              Upload synthetic PDF medical reports, view upload history, and preview or download original and redacted versions.
            </p>
            <div className="placeholder-footer">
              <span className="placeholder-tag">✅ Ready for Patients</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() =>
                  document
                    .getElementById('document-vault-section')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                Access Documents
              </button>
            </div>
          </div>

          {/* Module C */}
          <div className="module-card card placeholder-card">
            <div className="module-card-header">
              <div className="module-icon">🛡️</div>
              <span className="module-badge badge-placeholder">Module C — Teammate</span>
            </div>
            <h3>Consent Management</h3>
            <p className="module-desc">
              Granular consent authorization rules, doctor access grants, and time-based privacy revocations.
            </p>
            <div className="placeholder-footer">
              <span className="placeholder-tag">🚧 Under Development by Teammate</span>
              <button type="button" className="btn btn-disabled btn-sm" disabled>
                Manage Consents
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
