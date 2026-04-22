import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFAToken, setTwoFAToken] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, twoFAToken || undefined);
      navigate('/');
    } catch (err: any) {
      if (err.message.includes('2FA')) {
        setRequires2FA(true);
        setError('Enter your 2FA code');
      } else {
        setError(err.message || 'Login error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-panel">
        <h1 className="auth-title">Login</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              placeholder="your@email.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
              placeholder="••••••••"
            />
          </div>
          {requires2FA && (
            <div className="form-group">
              <label htmlFor="twoFAToken">2FA Code</label>
              <input
                id="twoFAToken"
                type="text"
                value={twoFAToken}
                onChange={(e) => setTwoFAToken(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="form-input otp-input"
              />
            </div>
          )}
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={loading} className="btn-premium">
            {loading ? 'Loading...' : 'Login'}
          </button>
        </form>
        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">Register here</Link>
        </p>
      </div>
    </div>
  );
}
