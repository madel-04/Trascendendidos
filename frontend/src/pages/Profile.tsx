import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API = '';

export default function Profile() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setTwoFAEnabled(user.twoFAEnabled);
  }, [user]);

  const handleSetup2FA = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/auth/2fa/setup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setQrCodeUrl(data.qrCodeUrl);
        setSecret(data.secret);
        setShowSetup(true);
        setMessage({ type: 'success', text: 'Scan the QR code with Google Authenticator or Authy' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Error generating QR code' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    if (verificationCode.length !== 6) {
      setMessage({ type: 'error', text: 'Code must be 6 digits' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/auth/2fa/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: verificationCode }),
      });
      const data = await response.json();
      if (response.ok) {
        setTwoFAEnabled(true);
        setShowSetup(false);
        setQrCodeUrl(null);
        setVerificationCode('');
        setMessage({ type: 'success', text: '2FA enabled successfully! 🎉' });
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: data.error || 'Incorrect code' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Are you sure you want to disable 2FA?')) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/auth/2fa/disable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setTwoFAEnabled(false);
        setMessage({ type: 'success', text: '2FA disabled' });
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: data.error || 'Error disabling 2FA' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="profile-page">
      <div className="profile-card glass-panel">
        <h1 className="profile-title">Profile</h1>

        {/* Account Info */}
        <div className="profile-section">
          <h2 className="section-label">Account Information</h2>
          <div className="profile-info">
            <div className="info-row"><span className="info-key">Username</span><span>{user?.username}</span></div>
            <div className="info-row"><span className="info-key">Email</span><span>{user?.email}</span></div>
            <div className="info-row"><span className="info-key">2FA</span><span>{twoFAEnabled ? '✅ Enabled' : '❌ Disabled'}</span></div>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className={`profile-message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* 2FA Section */}
        <div className="profile-section">
          <h2 className="section-label">Two-Factor Authentication</h2>
          <p className="section-desc">Add an extra layer of security to your account.</p>

          {!twoFAEnabled && !showSetup && (
            <button onClick={handleSetup2FA} disabled={loading} className="btn-premium">
              {loading ? 'Loading...' : 'Enable 2FA'}
            </button>
          )}

          {!twoFAEnabled && showSetup && qrCodeUrl && (
            <div className="twofa-setup">
              <p className="setup-step">Step 1: Scan QR Code</p>
              <p className="setup-desc">Use Google Authenticator, Authy or any TOTP app</p>
              <div className="qr-container">
                <img src={qrCodeUrl} alt="QR Code for 2FA" style={{ maxWidth: '180px' }} />
              </div>
              <details className="manual-entry">
                <summary>Can't scan? Enter code manually</summary>
                <code className="secret-code">{secret}</code>
              </details>
              <p className="setup-step">Step 2: Verify Code</p>
              <p className="setup-desc">Enter the 6-digit code from your app</p>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="form-input otp-input"
              />
              <div className="btn-row">
                <button
                  onClick={handleEnable2FA}
                  disabled={loading || verificationCode.length !== 6}
                  className="btn-premium"
                >
                  {loading ? 'Verifying...' : 'Verify & Enable'}
                </button>
                <button
                  onClick={() => { setShowSetup(false); setQrCodeUrl(null); setVerificationCode(''); }}
                  disabled={loading}
                  className="btn-premium secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {twoFAEnabled && (
            <div>
              <div className="twofa-badge">✅ Your account is protected with 2FA</div>
              <button onClick={handleDisable2FA} disabled={loading} className="btn-premium secondary">
                {loading ? 'Loading...' : 'Disable 2FA'}
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="btn-row">
          <button onClick={() => navigate('/')} className="btn-premium secondary">← Back</button>
          <button onClick={handleLogout} className="btn-premium">Logout</button>
        </div>
      </div>
    </div>
  );
}
