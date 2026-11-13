import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Verifying secure session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="unauthorized-container card">
        <div className="icon-shield-warning">🚫</div>
        <h2>Access Restricted</h2>
        <p>
          Your account role (<strong>{user.role}</strong>) does not have permission to view this section.
        </p>
        <p className="hint">
          This portal strictly separates Patient profile data from Healthcare Provider tools in accordance with healthcare privacy guidelines.
        </p>
        <a href="/dashboard" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Return to Dashboard
        </a>
      </div>
    );
  }

  return children;
}
