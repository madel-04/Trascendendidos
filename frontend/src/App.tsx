import { useState } from 'react';
import MainMenu from './components/MainMenu';
import GameView from './components/GameView';
import LanguageSwitcher from './components/LanguageSwitcher';
import Matchmaking from './components/Matchmaking';
import { useTranslation } from 'react-i18next';
import './styles/index.css';

// Simple view routing state for now, before implementing react-router if needed
type ViewState = 'MENU' | 'GAME' | 'LOBBY';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('MENU');
  const [multiplayerState, setMultiplayerState] = useState<{ roomId: string; side: 'left' | 'right' } | null>(null);
  const { t } = useTranslation();

  return (
    <div className="app-container">
      <LanguageSwitcher />
      {currentView === 'MENU' && <MainMenu onStartGame={() => { setMultiplayerState(null); setCurrentView('GAME'); }} onStartMultiplayer={() => setCurrentView('LOBBY')} />}
      {currentView === 'LOBBY' && <Matchmaking onMatchFound={(roomId, side) => { setMultiplayerState({ roomId, side }); setCurrentView('GAME'); }} onCancel={() => setCurrentView('MENU')} />}
      {currentView === 'GAME' && <GameView onExit={() => setCurrentView('MENU')} isMultiplayer={!!multiplayerState} multiplayerSide={multiplayerState?.side} roomId={multiplayerState?.roomId} />}

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
