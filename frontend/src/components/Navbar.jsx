import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isPatient = (user?.role || '').toLowerCase() === 'patient';

  // Minimal public navbar with brand + theme toggle when not signed in
  if (!isAuthenticated || !user) {
    return (
      <header className="navbar">
        <div className="navbar-container">
          <Link to="/login" className="navbar-brand">
            <div className="brand-icon-wrapper" aria-hidden="true">
              🛡️
            </div>
            <div className="brand-text">
              <span className="brand-title">MyMedData</span>
              <span className="brand-sub">Privacy Platform</span>
            </div>
          </Link>

          <div className="navbar-right">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              <span className="theme-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/login" className={`btn btn-sm ${location.pathname === '/login' ? 'btn-primary' : 'btn-outline'}`}>
                Sign In
              </Link>
              <Link to="/register" className={`btn btn-sm ${location.pathname === '/register' ? 'btn-primary' : 'btn-outline'}`}>
                Register
              </Link>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Authenticated Navbar
  return (
    <header className="navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-brand">
          <div className="brand-icon-wrapper" aria-hidden="true">
            🛡️
          </div>
          <div className="brand-text">
            <span className="brand-title">MyMedData</span>
            <span className="brand-sub">Privacy Platform</span>
          </div>
        </Link>

        <nav className="navbar-links" aria-label="Main Navigation">
          <Link
            to="/dashboard"
            className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
          >
            <span>📊</span> Dashboard
          </Link>
          {isPatient && (
            <>
              <Link
                to="/redaction"
                className={`nav-link ${location.pathname === '/redaction' ? 'active' : ''}`}
              >
                <span>🛡️</span> Redaction
              </Link>
              <Link
                to="/profile"
                className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
              >
                <span>👤</span> Medical Profile
              </Link>
            </>
          )}
        </nav>

        <div className="navbar-right">
          {/* Theme Toggle Button */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            <span className="theme-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
          </button>

          <div className="navbar-user">
            <div className="user-info">
              <span className="user-name">{user.full_name}</span>
              <span className={`role-badge role-${(user.role || '').toLowerCase()}`}>
                {user.role?.toLowerCase() === 'provider' ? '👨‍⚕️ Provider' : '👤 Patient'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm logout-btn"
              onClick={handleLogout}
              title="Log out securely"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
