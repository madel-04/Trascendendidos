import { useState } from 'react';
import MainMenu from './components/MainMenu';
import GameView from './components/GameView';
import LanguageSwitcher from './components/LanguageSwitcher';
import Matchmaking from './components/Matchmaking';
import SettingsPanel from './components/SettingsPanel';
import { useTranslation } from 'react-i18next';
import { socket } from './game/socket';
import './styles/index.css';

// Simple view routing state for now, before implementing react-router if needed
type ViewState = 'MENU' | 'LOBBY' | 'GAME' | 'SETTINGS';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('MENU');
  const [settings, setSettings] = useState({ targetScore: 5, difficulty: 'Beginner' });
  const [multiplayerState, setMultiplayerState] = useState<{ roomId: string; side: 'left' | 'right' } | null>(null);
  const [isMatchFinished, setIsMatchFinished] = useState<{ finished: boolean }>({ finished: false });
  const { t } = useTranslation();

  return (
    <div className="app-container">
      <header className="main-header" style={{ width: '100%', minHeight: '80px', padding: '10px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
        
        {/* Wrap header contents to precisely match the 800px game panel width */}
        <div style={{ width: '100%', maxWidth: currentView === 'GAME' ? '800px' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* Left Side: Match Title */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            {currentView === 'GAME' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', lineHeight: 1 }}>
                  {multiplayerState ? t('MULTIPLAYER MATCH') : t('LOCAL MATCH')}
                </h2>
                {!multiplayerState && (
                  <span style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', lineHeight: 1, fontWeight: 600 }}>
                    {t(settings.difficulty.toUpperCase())} ({settings.targetScore})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Center: Language Switcher ALWAYS centered */}
          <div style={{ flex: 0, display: 'flex', justifyContent: 'center' }}>
             <LanguageSwitcher />
          </div>

          {/* Right Side: Exit Button */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            {currentView === 'GAME' && !isMatchFinished.finished && (
              <button 
                className="btn-premium secondary" 
                style={{ padding: '8px 16px', fontSize: '0.9rem', height: 'fit-content' }} 
                onClick={() => {
                  if (multiplayerState) socket.emit('leave_match');
                  setCurrentView('MENU');
                }}
              >
                {t('EXIT TO MENU')}
              </button>
            )}
          </div>
          
        </div>
      </header>
      {currentView === 'MENU' && <MainMenu onStartGame={() => { setMultiplayerState(null); setIsMatchFinished({ finished: false }); setCurrentView('GAME'); }} onStartMultiplayer={() => setCurrentView('LOBBY')} onOpenSettings={() => setCurrentView('SETTINGS')} />}
      {currentView === 'SETTINGS' && <SettingsPanel currentSettings={settings} onSave={(s) => { setSettings(s); setCurrentView('MENU'); }} onCancel={() => setCurrentView('MENU')} />}
      {currentView === 'LOBBY' && <Matchmaking onMatchFound={(roomId, side) => { setMultiplayerState({ roomId, side }); setIsMatchFinished({ finished: false }); setCurrentView('GAME'); }} onCancel={() => setCurrentView('MENU')} />}
      {currentView === 'GAME' && <GameView onExit={() => setCurrentView('MENU')} isMultiplayer={!!multiplayerState} multiplayerSide={multiplayerState?.side} roomId={multiplayerState?.roomId} onStatusChange={(f: boolean) => setIsMatchFinished({ finished: f })} settings={settings} />}

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
