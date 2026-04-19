import React from 'react';
import { useTranslation } from 'react-i18next';

interface MainMenuProps {
  onStartGame: () => void;
  onStartMultiplayer: () => void;
  onOpenSettings: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, onStartMultiplayer, onOpenSettings }) => {
  const { t } = useTranslation();
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
        <button className="btn-premium secondary" onClick={onStartMultiplayer}>
          {t('MULTIPLAYER')}
        </button>
        <button className="btn-premium tertiary" onClick={onOpenSettings}>
          ⚙️ {t('SETTINGS')}
        </button>
      </div>
    </div>
  );
};

export default MainMenu;
