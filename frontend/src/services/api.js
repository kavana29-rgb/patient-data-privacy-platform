
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
    if (!error.status) {
      error.message =
        error.message ||
        'Unable to connect to the backend server. Please verify the API is running.';
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Authentication Endpoints
// ---------------------------------------------------------------------------

export const authApi = {
  register: (userData) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  login: (credentials) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getMe: () =>
    request('/auth/me', {
      method: 'GET',
    }),
};

// ---------------------------------------------------------------------------
// Patient Profile Endpoints
// ---------------------------------------------------------------------------

export const patientApi = {
  getProfile: () =>
    request('/patient/profile', {
      method: 'GET',
    }),

  updateProfile: (profileData) =>
    request('/patient/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),
};

// ---------------------------------------------------------------------------
// Medical Document Endpoints (Module B)
// ---------------------------------------------------------------------------

export const documentApi = {
  listDocuments: () =>
    request('/documents/', {
      method: 'GET',
    }),

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
      throw new Error(
        (data && (data.detail || data.message)) ||
        'Document upload failed.'
      );
    }

    return data;
  },

  fetchDocumentBlob: async (docId, version = 'original') => {
    const token = localStorage.getItem('token');

    const response = await fetch(
      `${API_BASE_URL}/documents/${docId}/file?version=${version}`,
      {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(
        (data && (data.detail || data.message)) ||
        `Unable to load ${version} PDF.`
      );
    }

    return await response.blob();
  },
};

// ---------------------------------------------------------------------------
// Secure Document Sharing Endpoints (Module E)
// ---------------------------------------------------------------------------

export const sharingApi = {

  // Provider: create a patient document access request
  createRequest: (requestData) =>
    request('/sharing/requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    }),

  // Provider: view requests created by the logged-in provider
  getProviderRequests: () =>
    request('/sharing/provider/requests', {
      method: 'GET',
    }),

  // Patient: view access requests received from providers
  getPatientRequests: () =>
    request('/sharing/patient/requests', {
      method: 'GET',
    }),

  // Patient: view document access audit history
  getPatientAuditHistory: () =>
    request('/sharing/patient/audit-history', {
      method: 'GET',
    }),

  // Patient: approve or reject a provider's request
  decideRequest: (requestId, decisionData) =>
    request(`/sharing/patient/requests/${requestId}/decision`, {
      method: 'PATCH',
      body: JSON.stringify(decisionData),
    }),

  // Provider: download a document after consent approval
  fetchSharedDocument: async (requestId) => {
    const token = localStorage.getItem('token');

    const response = await fetch(
      `${API_BASE_URL}/sharing/requests/${requestId}/document`,
      {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      throw new Error(
        (data && (data.detail || data.message)) ||
        'Unable to access the shared document.'
      );
    }

    return await response.blob();
  },
};

// ---------------------------------------------------------------------------
// Default API Export
// ---------------------------------------------------------------------------

export default {
  auth: authApi,
  patient: patientApi,
  documents: documentApi,
  sharing: sharingApi,
};
