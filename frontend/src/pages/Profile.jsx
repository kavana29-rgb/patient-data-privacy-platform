import { useState, useEffect } from 'react';
import { patientApi } from '../services/api';
import { useAuth } from '../context/useAuth';

export default function Profile() {
  const { user, updateUser } = useAuth();

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
        phone_number: phoneNumber.trim() || null,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        address: address.trim() || null,
        emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null,
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

      setSuccessMessage('Your medical profile has been updated successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Failed to save changes. Please try again.');
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
    <div className="profile-page container">
      <div className="page-header">
        <div>
          <h1>My Medical Profile</h1>
          <p className="text-muted">
            View and manage your personal health information, allergies, and emergency contacts.
          </p>
        </div>
        <div className="user-role-tag">
          <span className="badge badge-green">✓ Authenticated Patient</span>
        </div>
      </div>

      {successMessage && (
        <div className="alert alert-success" role="alert">
          <span className="alert-icon">✅</span>
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
        <div className="card form-section-card">
          <h2 className="section-title">Identity & Account Details</h2>
          <p className="section-subtitle">
            Your system account information (User ID: #{user?.id}). Email is locked for security.
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

        <div className="card form-section-card">
          <h2 className="section-title">Personal & Contact Information</h2>

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
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                className="form-control"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={saving}
              >
                <option value="">Select Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-Binary">Non-Binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="bloodGroup">Blood Group</label>
              <select
                id="bloodGroup"
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

          <div className="form-group">
            <label htmlFor="address">Home Address</label>
            <input
              id="address"
              type="text"
              className="form-control"
              placeholder="Street address, city, state, zip"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="card form-section-card">
          <h2 className="section-title">Emergency Contact</h2>
          <p className="section-subtitle">
            Authorized contact in case of urgent medical scenarios.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="emName">Contact Name</label>
              <input
                id="emName"
                type="text"
                className="form-control"
                placeholder="e.g. John Connor (Spouse / Guardian)"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="emPhone">Contact Phone Number</label>
              <input
                id="emPhone"
                type="tel"
                className="form-control"
                placeholder="+1 (555) 999-8888"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <div className="card form-section-card">
          <h2 className="section-title">Allergies & Clinical History</h2>
          <p className="section-subtitle">
            Essential clinical indicators shared only with authorized healthcare personnel under your consent.
          </p>

          <div className="form-group">
            <label htmlFor="allergies">Known Allergies</label>
            <textarea
              id="allergies"
              rows={3}
              className="form-control"
              placeholder="e.g. Penicillin, Peanuts, Latex..."
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="history">Medical History & Conditions</label>
            <textarea
              id="history"
              rows={4}
              className="form-control"
              placeholder="e.g. Type 2 Diabetes, Mild Asthma, Hypertension..."
              value={medicalHistory}
              onChange={(e) => setMedicalHistory(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={saving}
          >
            {saving ? (
              <span className="btn-loading">
                <span className="spinner-sm"></span> Saving Profile...
              </span>
            ) : (
              '💾 Save Profile Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
