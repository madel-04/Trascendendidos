import React, { useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

// Components
import MainMenu from './components/MainMenu';
import GameView from './components/GameView';
import LanguageSwitcher from './components/LanguageSwitcher';
import ProtectedRoute from './components/ProtectedRoute';

import './styles/index.css';

// ─── Home page: keeps the existing game flow ─────────────────────────────────
type GameState = 'MENU' | 'GAME';

function HomePage() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {gameState === 'MENU' && <MainMenu onStartGame={() => setGameState('GAME')} />}
      {gameState === 'GAME' && <GameView onExit={() => setGameState('MENU')} />}
    </div>
  );
}

// ─── Nav bar ─────────────────────────────────────────────────────────────────
function NavBar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="main-nav">
      <div className="nav-left">
        <Link to="/" className="nav-logo">42 PONG</Link>
        <Link to="/privacy" className="nav-link">{t('Privacy')}</Link>
        <Link to="/terms" className="nav-link">{t('Terms')}</Link>
      </div>
      <div className="nav-right">
        <LanguageSwitcher />
        {user ? (
          <>
            <Link to="/profile" className="nav-link nav-user">👤 {user.username}</Link>
            <button onClick={handleLogout} className="btn-premium secondary nav-btn">
              {t('Logout')}
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-premium secondary nav-btn">{t('Login')}</Link>
            <Link to="/register" className="btn-premium nav-btn">{t('Register')}</Link>
          </>
        )}
      </div>
    </nav>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <NavBar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="main-footer">
        <p>
          <span>&copy; 2026. 42 Madrid - Pong</span>
          {' · '}
          <Link to="/privacy">Privacy Policy</Link>
          {' · '}
          <Link to="/terms">Terms of Service</Link>
        </p>
      </footer>
    </div>
  );
}
