import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';

export default function Register() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [role, setRole] = useState('patient');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [providerInviteCode, setProviderInviteCode] = useState('');

  // Optional demographic fields for patient profile
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [address, setAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(pwd)) return 'Password must include at least one uppercase letter.';
    if (!/[a-z]/.test(pwd)) return 'Password must include at least one lowercase letter.';
    if (!/[0-9]/.test(pwd)) return 'Password must include at least one number.';
    return null;
  };

  const formatPhoneNumber = (value) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('+91') || trimmed.startsWith('+')) return trimmed;
    if (/^91\d{10}$/.test(trimmed)) return `+${trimmed}`;
    return `+91 ${trimmed}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    const pwdError = validatePassword(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (role === 'provider' && !providerInviteCode.trim()) {
      setError('Healthcare Provider registration requires an official invitation or authorization code.');
      return;
    }

    const sanitizedPhone = formatPhoneNumber(phoneNumber);

    const payload = {
      role,
      full_name: fullName.trim(),
      email: email.trim(),
      password,
      ...(role === 'provider' ? { provider_invite_code: providerInviteCode.trim() } : {}),
      ...(role === 'patient'
        ? {
            phone_number: sanitizedPhone,
            date_of_birth: dateOfBirth || null,
            gender: gender || null,
            blood_group: bloodGroup || null,
            address: address.trim() || null,
          }
        : {}),
    };

    setLoading(true);
    try {
      await register(payload);
      showToast('Account registered successfully! Welcome to MyMedData.', 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card register-card card">
        <div className="auth-header">
          <div className="auth-icon-circle" aria-hidden="true">
            🏥
          </div>
          <h1>Create Your Account</h1>
          <p className="auth-subtitle">
            Join MyMedData to safeguard your medical data with granular privacy
          </p>
        </div>

        {/* Role Switcher */}
        <div className="role-selector" role="tablist" aria-label="Registration Role">
          <button
            type="button"
            className={`role-tab ${role === 'patient' ? 'active' : ''}`}
            onClick={() => setRole('patient')}
            disabled={loading}
            role="tab"
            aria-selected={role === 'patient'}
          >
            <span className="role-tab-icon">👤</span>
            <span className="role-tab-title">Patient Account</span>
            <span className="role-tab-desc">Own & control your medical files</span>
          </button>
          <button
            type="button"
            className={`role-tab ${role === 'provider' ? 'active' : ''}`}
            onClick={() => setRole('provider')}
            disabled={loading}
            role="tab"
            aria-selected={role === 'provider'}
          >
            <span className="role-tab-icon">👨‍⚕️</span>
            <span className="role-tab-title">Healthcare Provider</span>
            <span className="role-tab-desc">Clinician document access portal</span>
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fullName">Full Legal Name *</label>
              <input
                id="fullName"
                type="text"
                className="form-control"
                placeholder="e.g. Aarav Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                id="email"
                type="email"
                className="form-control"
                placeholder="e.g. aarav@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Min 8 chars, 1 upper, 1 number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((p) => !p)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex="-1"
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>
          </div>

          {role === 'provider' && (
            <div className="card-subtle" style={{ marginBottom: '1.25rem', borderColor: 'var(--border-focus)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="providerInviteCode">
                  Hospital / Clinical Authorization Code *
                </label>
                <input
                  id="providerInviteCode"
                  type="text"
                  className="form-control"
                  placeholder="e.g. HOSP-2026-INVITE"
                  value={providerInviteCode}
                  onChange={(e) => setProviderInviteCode(e.target.value)}
                  required
                  disabled={loading}
                />
                <span className="form-hint">
                  Healthcare providers require an invitation code issued by the medical administration.
                </span>
              </div>
            </div>
          )}

          {role === 'patient' && (
            <div className="patient-profile-section">
              <h2 className="section-title">Health Profile Details (Optional)</h2>
              <p className="section-subtitle">
                You can also configure or update these details anytime from your dashboard.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phoneNumber">Phone Number</label>
                  <input
                    id="phoneNumber"
                    type="tel"
                    className="form-control"
                    placeholder="e.g. 9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="dateOfBirth">Date of Birth</label>
                  <input
                    id="dateOfBirth"
                    type="date"
                    className="form-control"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="gender">Gender</label>
                  <select
                    id="gender"
                    className="form-control"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="bloodGroup">Blood Group</label>
                  <select
                    id="bloodGroup"
                    className="form-control"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="address">Residential Address</label>
                <textarea
                  id="address"
                  className="form-control"
                  rows="2"
                  placeholder="Street address, city, state, postal code"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-sm"></span> Creating Account...
              </>
            ) : (
              `Register as ${role === 'patient' ? 'Patient' : 'Healthcare Provider'}`
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in here
            </Link>
          </p>
        </div>

        <div className="security-notice">
          <span>🛡️</span>
          <span>Your sensitive records are secured with cryptographic zero-trust privacy.</span>
        </div>
      </div>
    </div>
  );
}
