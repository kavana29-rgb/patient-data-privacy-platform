/**
 * Centralized API client for Patient Data Privacy Platform
 * Handles baseUrl, JWT Bearer headers, and unified error handling.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // If unauthorized or expired token, clear storage and trigger event
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage =
        (data && (data.detail || data.message)) ||
        `Request failed with status ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    // Re-throw with formatted message if network fails
    if (!error.status) {
      error.message = error.message || 'Unable to connect to the backend server. Please verify the API is running.';
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Authentication Endpoints
// ---------------------------------------------------------------------------
export const authApi = {
  /**
   * Register a new patient or healthcare provider
   */
  register: (userData) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  /**
   * Login with email and password
   */
  login: (credentials) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  /**
   * Retrieve current authenticated user and profile
   */
  getMe: () =>
    request('/auth/me', {
      method: 'GET',
    }),
};

// ---------------------------------------------------------------------------
// Patient Profile Endpoints
// ---------------------------------------------------------------------------
export const patientApi = {
  /**
   * Retrieve authenticated patient's profile
   */
  getProfile: () =>
    request('/patient/profile', {
      method: 'GET',
    }),

  /**
   * Update authenticated patient's profile
   */
  updateProfile: (profileData) =>
    request('/patient/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),
};

export default {
  auth: authApi,
  patient: patientApi,
};

