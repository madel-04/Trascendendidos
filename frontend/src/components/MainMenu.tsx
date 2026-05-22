import React from 'react';
import { useTranslation } from 'react-i18next';

interface MainMenuProps {
  onStartGame: () => void;
  onStartMultiplayer: () => void;
  onOpenSettings?: () => void;
  notice?: string | null;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, onStartMultiplayer, onOpenSettings, notice }) => {
  const { t } = useTranslation();

  return (
    <div className="glass-panel main-menu main-menu-options-shell play-hub-panel play-hub-panel-enter">
      <div className="main-menu-options-content">
        <div className="main-menu-options-header">
          <div className="main-menu-kicker">{t("CHOOSE YOUR MODE")}</div>
          <h1 className="title-glow main-menu-options-title">NEON PONG</h1>
        </div>

        {notice ? (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255, 77, 103, 0.5)",
              background: "rgba(255, 77, 103, 0.12)",
              color: "#ffd2db",
              textAlign: "center",
              fontSize: 14,
            }}
          >
            {notice}
          </div>
        ) : null}

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
