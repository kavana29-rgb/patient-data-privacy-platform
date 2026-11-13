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

// ---------------------------------------------------------------------------
// Medical Document Endpoints (Module B - Daiwik)
// ---------------------------------------------------------------------------
export const documentApi = {
  /**
   * List all medical documents belonging to the authenticated patient
   */
  listDocuments: () =>
    request('/documents/', {
      method: 'GET',
    }),

  /**
   * Upload a new PDF medical document using FormData
   */
  uploadDocument: async (file) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error((data && (data.detail || data.message)) || 'Document upload failed.');
    }
    return data;
  },

  /**
   * Fetch PDF binary blob for in-app preview or download ('original' or 'redacted')
   */
  fetchDocumentBlob: async (docId, version = 'original') => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/documents/${docId}/file?version=${version}`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error((data && (data.detail || data.message)) || `Unable to load ${version} PDF.`);
    }
    return await response.blob();
  },
};

export default {
  auth: authApi,
  patient: patientApi,
  documents: documentApi,
};

