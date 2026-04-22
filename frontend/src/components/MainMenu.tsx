import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

interface MainMenuProps {
  onStartGame: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartGame }) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="glass-panel main-menu">
      <h1 className="title-glow">{'42 MADRID - PONG'}</h1>

      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <img
          src="/pong_cover_art.png"
          alt="Pong Arcade Cover"
          style={{ width: '250px', borderRadius: '12px', boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)', border: '2px solid rgba(255, 255, 255, 0.1)' }}
        />
      </div>

      <div className="menu-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
        <button className="btn-premium" onClick={onStartGame}>
          {t('PLAY LOCAL (2P)')}
        </button>
        <button className="btn-premium secondary" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
          {t('MULTIPLAYER (COMING SOON)')}
        </button>
        {user ? (
          <Link to="/profile" className="btn-premium secondary" style={{ textAlign: 'center', textDecoration: 'none' }}>
            👤 {user.username} — {t('Profile')}
          </Link>
        ) : (
          <Link to="/login" className="btn-premium secondary" style={{ textAlign: 'center', textDecoration: 'none' }}>
            {t('LOGIN / REGISTER')}
          </Link>
        )}
      </div>
    </div>
  );
};

export default MainMenu;
