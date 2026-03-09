import React, { useState } from 'react';
import MainMenu from './components/MainMenu';
import GameView from './components/GameView';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import './styles/index.css';

// Simple view routing state for now, before implementing react-router if needed
type ViewState = 'MENU' | 'GAME' | 'LOBBY';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('MENU');
  const { t } = useTranslation();

  return (
    <div className="app-container">
      <LanguageSwitcher />
      {currentView === 'MENU' && <MainMenu onStartGame={() => setCurrentView('GAME')} />}
      {currentView === 'GAME' && <GameView onExit={() => setCurrentView('MENU')} />}

      <footer className="main-footer">
        <p>
          <div>&copy;2026. 42 Madrid - Pong</div>
          <a href="#privacy">{t('Privacy Policy')}</a> |
          <a href="#terms">{t('Terms of Service')}</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
