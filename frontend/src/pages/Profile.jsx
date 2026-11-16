import { useState, useEffect } from 'react';
import { patientApi } from '../services/api';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchProfile() {
      setLoading(true);
      setError('');
      try {
        const data = await patientApi.getProfile();
        if (isMounted && data) {
          setPhoneNumber(data.phone_number || '');
          setDateOfBirth(data.date_of_birth || '');
          setGender(data.gender || '');
          setAddress(data.address || '');
          setEmergencyContactName(data.emergency_contact_name || '');
          setEmergencyContactPhone(data.emergency_contact_phone || '');
          setBloodGroup(data.blood_group || '');
          setAllergies(data.allergies || '');
          setMedicalHistory(data.medical_history || '');
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load profile data.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatPhoneNumber = (val) => {
    if (!val) return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('+91') || trimmed.startsWith('+')) return trimmed;
    if (/^91\d{10}$/.test(trimmed)) return `+${trimmed}`;
    return `+91 ${trimmed}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }

    setSaving(true);
    try {
      const updatePayload = {
        full_name: fullName.trim(),
        phone_number: formatPhoneNumber(phoneNumber),
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        address: address.trim() || null,
        emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: formatPhoneNumber(emergencyContactPhone),
        blood_group: bloodGroup || null,
        allergies: allergies.trim() || null,
        medical_history: medicalHistory.trim() || null,
      };

      const updatedProfile = await patientApi.updateProfile(updatePayload);

      if (user) {
        updateUser({
          ...user,
          full_name: fullName.trim(),
          patient_profile: updatedProfile,
        });
      }

      const okMsg = 'Your medical profile has been updated successfully!';
      setSuccessMessage(okMsg);
      showToast(okMsg, 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const errMsg = err.message || 'Failed to save changes. Please try again.';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem 0' }}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading patient profile details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container profile-page" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div className="dashboard-badge-pill">
            <span>👤</span> Patient Profile Management
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            My Medical Health Profile
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.885rem' }}>
            View and update your personal health record, blood group, allergies, and emergency contacts.
          </p>
        </div>
        <div>
          <span className="badge badge-green">
            ✓ Authenticated Patient #{user?.id}
          </span>
        </div>
      </div>

      {successMessage && (
        <div className="alert alert-success" role="alert">
          <span className="alert-icon">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="profile-form">
        {/* Account Identity */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Identity & Account Credentials
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Primary account credentials. Email address is locked to maintain cryptographic signature validity.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fullName">Full Legal Name *</label>
              <input
                id="fullName"
                type="text"
                className="form-control"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="userEmail">Registered Email Address</label>
              <input
                id="userEmail"
                type="email"
                className="form-control"
                value={user?.email || ''}
                readOnly
                disabled
              />
              <span className="form-hint">Email address cannot be modified directly.</span>
            </div>
          </div>
        </div>

        {/* Demographic & Contact Information */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Contact & Demographic Information
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Contact details used by healthcare providers during authorized consultations.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">Phone Number (+91 India)</label>
              <input
                id="phone"
                type="tel"
                className="form-control"
                placeholder="+91 98765 43210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={saving}
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
                disabled={saving}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="genderSelect">Gender</label>
              <select
                id="genderSelect"
                className="form-control"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={saving}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="bloodGroupSelect">Blood Group</label>
              <select
                id="bloodGroupSelect"
                className="form-control"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                disabled={saving}
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="addressInput">Residential Address</label>
            <textarea
              id="addressInput"
              className="form-control"
              rows="2"
              placeholder="Street, City, State, PIN Code"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Emergency Contact Information
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Next of kin or primary contact to be notified in clinical emergencies.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="emgName">Emergency Contact Person</label>
              <input
                id="emgName"
                type="text"
                className="form-control"
                placeholder="e.g. Priya Sharma (Spouse)"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="emgPhone">Emergency Contact Phone</label>
              <input
                id="emgPhone"
                type="tel"
                className="form-control"
                placeholder="+91 98765 01234"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
        </div>

        {/* Clinical Notes & Allergies */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Clinical Disclosures & Allergies
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Critical medical details visible to attending physicians when access is authorized.
          </p>

          <div className="form-group">
            <label htmlFor="allergiesInput">Known Allergies & Drug Reactions</label>
            <textarea
              id="allergiesInput"
              className="form-control"
              rows="2"
              placeholder="e.g. Penicillin, Peanuts, Sulfa antibiotics"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="historyInput">Relevant Medical History & Chronic Conditions</label>
            <textarea
              id="historyInput"
              className="form-control"
              rows="3"
              placeholder="e.g. Type 2 Diabetes, Hypertension, prior surgeries"
              value={medicalHistory}
              onChange={(e) => setMedicalHistory(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        {/* Save Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '2rem' }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-sm"></span> Saving Updates...
              </>
            ) : (
              '💾 Save Medical Profile'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
