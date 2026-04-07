import React from 'react';
import PongCanvas from './PongCanvas';
import { socket } from '../game/socket';
import { useTranslation } from 'react-i18next';

interface GameViewProps {
  onExit: () => void;
  isMultiplayer?: boolean;
  multiplayerSide?: 'left' | 'right';
  roomId?: string;
}

const GameView: React.FC<GameViewProps> = ({ onExit, isMultiplayer, multiplayerSide, roomId }) => {
  const { t } = useTranslation();

  React.useEffect(() => {
    if (isMultiplayer) {
      const handleOpponentDisconnected = () => {
        alert(t('Opponent disconnected or left! Match ended.'));
        onExit();
      };
      
      socket.on('opponent_disconnected', handleOpponentDisconnected);
      socket.on('match_ended', handleOpponentDisconnected);
      
      return () => {
        socket.off('opponent_disconnected', handleOpponentDisconnected);
        socket.off('match_ended', handleOpponentDisconnected);
      };
    }
  }, [isMultiplayer, onExit, t]);

  const handleManualExit = () => {
    if (isMultiplayer) {
      socket.emit('leave_match');
    }
    onExit();
  };

  return (
    <div className="game-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', flex: 1 }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>{isMultiplayer ? t('MULTIPLAYER MATCH') : t('LOCAL MATCH')}</h2>
        <button className="btn-premium secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={handleManualExit}>
          {t('EXIT TO MENU')}
        </button>
      </div>
      
      <div className="glass-panel" style={{ padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <PongCanvas isMultiplayer={isMultiplayer} side={multiplayerSide} roomId={roomId} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '800px', marginTop: '1rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h3>{t('PLAYER 1')}</h3>
          <p style={{ color: 'var(--text-muted)' }}>{t('W / S to move')}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3>{t('PLAYER 2')}</h3>
          <p style={{ color: 'var(--text-muted)' }}>{t('Up / Down to move')}</p>
        </div>
      </div>
    </div>
  );
};

export default GameView;
