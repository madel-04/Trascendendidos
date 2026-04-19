import { useState } from 'react';
import MainMenu from './components/MainMenu';
import GameView from './components/GameView';
import LanguageSwitcher from './components/LanguageSwitcher';
import Matchmaking from './components/Matchmaking';
import { useTranslation } from 'react-i18next';
import { socket } from './game/socket';
import './styles/index.css';

// Simple view routing state for now, before implementing react-router if needed
type ViewState = 'MENU' | 'GAME' | 'LOBBY';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('MENU');
  const [multiplayerState, setMultiplayerState] = useState<{ roomId: string; side: 'left' | 'right' } | null>(null);
  const [isMatchFinished, setIsMatchFinished] = useState<{ finished: boolean }>({ finished: false });
  const { t } = useTranslation();

  return (
    <div className="app-container">
      <header className="main-header" style={{ width: '100%', minHeight: '80px', padding: '10px 20px', display: 'flex', justifyContent: currentView === 'GAME' ? 'space-between' : 'center', alignItems: 'center', flexShrink: 0 }}>
        {currentView === 'GAME' && (
          <h2 style={{ margin: 0, fontSize: '1.2rem', lineHeight: 1, display: 'flex', alignItems: 'center' }}>{multiplayerState ? t('MULTIPLAYER MATCH') : t('LOCAL MATCH')}</h2>
        )}
        <LanguageSwitcher />
        {currentView === 'GAME' && !isMatchFinished.finished && (
          <button className="btn-premium secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', height: 'fit-content' }} onClick={() => {
            if (multiplayerState) socket.emit('leave_match');
            setCurrentView('MENU');
          }}>
            {t('EXIT TO MENU')}
          </button>
        )}
      </header>
      {currentView === 'MENU' && <MainMenu onStartGame={() => { setMultiplayerState(null); setIsMatchFinished({ finished: false }); setCurrentView('GAME'); }} onStartMultiplayer={() => setCurrentView('LOBBY')} />}
      {currentView === 'LOBBY' && <Matchmaking onMatchFound={(roomId, side) => { setMultiplayerState({ roomId, side }); setIsMatchFinished({ finished: false }); setCurrentView('GAME'); }} onCancel={() => setCurrentView('MENU')} />}
      {currentView === 'GAME' && <GameView onExit={() => setCurrentView('MENU')} isMultiplayer={!!multiplayerState} multiplayerSide={multiplayerState?.side} roomId={multiplayerState?.roomId} onStatusChange={(f: boolean) => setIsMatchFinished({ finished: f })} />}

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
