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
    <div className="glass-panel main-menu main-menu-options-shell play-hub-panel play-hub-panel-enter">
      <div className="main-menu-options-content">
        <div className="main-menu-options-header">
          <div className="main-menu-kicker">{t("CHOOSE YOUR MODE")}</div>
          <h1 className="title-glow main-menu-options-title">NEON PONG</h1>
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
    </div>
  );
};

export default MainMenu;
