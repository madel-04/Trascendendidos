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



  return (
    <div className="game-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', flex: 1, padding: '10px 0' }}>
      <div className="glass-panel" style={{ padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: '800px' }}>
        <PongCanvas isMultiplayer={isMultiplayer} side={multiplayerSide} roomId={roomId} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '800px', marginTop: '0.5rem', padding: '0 10px' }}>
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
