import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('patient');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [providerInviteCode, setProviderInviteCode] = useState('');

  // Optional patient profile fields
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
      setError('Healthcare Provider registration requires an authorization/invite code.');
      return;
    }

    const payload = {
      role,
      full_name: fullName.trim(),
      email: email.trim(),
      password,
      ...(role === 'provider' ? { provider_invite_code: providerInviteCode.trim() } : {}),
      ...(role === 'patient'
        ? {
            phone_number: phoneNumber.trim() || null,
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
          <div className="auth-icon-circle">🏥</div>
          <h1>Create an Account</h1>
          <p className="auth-subtitle">
            Join the Patient-Centric Medical Data Privacy Platform
          </p>
        </div>

        <div className="role-selector">
          <button
            type="button"
            className={`role-tab ${role === 'patient' ? 'active' : ''}`}
            onClick={() => setRole('patient')}
            disabled={loading}
          >
            <span className="role-tab-icon">👤</span>
            <span className="role-tab-title">Patient</span>
            <span className="role-tab-desc">Control your medical data</span>
          </button>
          <button
            type="button"
            className={`role-tab ${role === 'provider' ? 'active' : ''}`}
            onClick={() => setRole('provider')}
            disabled={loading}
          >
            <span className="role-tab-icon">👨‍⚕️</span>
            <span className="role-tab-title">Healthcare Provider</span>
            <span className="role-tab-desc">Clinician access portal</span>
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
                placeholder={role === 'patient' ? 'e.g. Jane Doe' : 'e.g. Dr. John Watson'}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="regEmail">Email Address *</label>
              <input
                id="regEmail"
                type="email"
                className="form-control"
                placeholder="e.g. name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="regPassword">Password *</label>
              <input
                id="regPassword"
                type="password"
                className="form-control"
                placeholder="Min. 8 chars (A-Z, a-z, 0-9)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                id="confirmPassword"
                type="password"
                className="form-control"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {role === 'provider' && (
            <div className="provider-code-section">
              <div className="form-group">
                <label htmlFor="providerCode">
                  Provider Authorization / Invite Code *
                </label>
                <input
                  id="providerCode"
                  type="text"
                  className="form-control"
                  placeholder="Enter administrator-issued invite code"
                  value={providerInviteCode}
                  onChange={(e) => setProviderInviteCode(e.target.value)}
                  required
                  disabled={loading}
                />
                <span className="form-hint">
                  ℹ️ Provider registrations require hospital or administrator verification.
                  (Default invite code: <code>MED-PROVIDER-2026</code>)
                </span>
              </div>
            </div>
          )}

          {role === 'patient' && (
            <div className="patient-profile-section">
              <h3 className="section-title">Initial Profile Information (Optional)</h3>
              <p className="section-subtitle">
                You can also configure or update these details anytime from your profile screen.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    className="form-control"
                    placeholder="+1 (555) 000-0000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="dob">Date of Birth</label>
                  <input
                    id="dob"
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
                  <label htmlFor="blood">Blood Group</label>
                  <select
                    id="blood"
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
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="address">Residential Address</label>
                <input
                  id="address"
                  type="text"
                  className="form-control"
                  placeholder="Street, City, State, ZIP"
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
              <span className="btn-loading">
                <span className="spinner-sm"></span> Creating Account...
              </span>
            ) : (
              `Create ${role === 'provider' ? 'Healthcare Provider' : 'Patient'} Account`
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign In Here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
