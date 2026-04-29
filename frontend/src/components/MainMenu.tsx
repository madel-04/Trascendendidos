import React from 'react';
import { useTranslation } from 'react-i18next';

interface MainMenuProps {
  onStartGame: () => void;
  onStartMultiplayer: () => void;
  onOpenSettings?: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, onStartMultiplayer, onOpenSettings }) => {
  const { t } = useTranslation();
  return (
    <div className="glass-panel main-menu">
      <h1 className="title-glow">{'42 MADRID - PONG'}</h1>

      <div className="menu-cover-wrap">
        <img
          src="/pong_cover_art.png"
          alt="Pong Arcade Cover"
          className="menu-cover"
        />
      </div>

      <div className="menu-buttons">
        <button className="btn-premium" onClick={onStartGame}>
          {t('PLAY LOCAL (2P)')}
        </button>
        <button className="btn-premium secondary" onClick={onStartMultiplayer}>
          {t('MULTIPLAYER')}
        </button>
        {onOpenSettings && (
          <button className="btn-premium tertiary" onClick={onOpenSettings}>
            {t('SETTINGS')}
          </button>
        )}
      </div>
    </div>
  );
};

export default MainMenu;
