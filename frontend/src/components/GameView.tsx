import React from 'react';
import PongCanvas from './PongCanvas';
import { socket } from '../game/socket';
import { useTranslation } from 'react-i18next';

interface GameViewProps {
  onExit: () => void;
  isMultiplayer?: boolean;
  multiplayerSide?: 'left' | 'right';
  roomId?: string;
  onStatusChange?: (finished: boolean) => void;
  settings: { targetScore: number; difficulty: string };
}

const GameView: React.FC<GameViewProps> = ({ onExit, isMultiplayer, multiplayerSide, roomId, onStatusChange, settings }) => {
  const { t } = useTranslation();
  const [matchStatus, setMatchStatus] = React.useState<'playing' | 'finished'>('playing');
  const [winner, setWinner] = React.useState<'left' | 'right' | null>(null);
  const [rematchRequested, setRematchRequested] = React.useState(false);
  const [rematchCount, setRematchCount] = React.useState(0);

  const handleMatchEndedEngine = (winSide: 'left' | 'right') => {
    // Si la partida es local notificamos directamente e interrumpimos
    if (!isMultiplayer) {
      setMatchStatus('finished');
      setWinner(winSide);
      if (onStatusChange) onStatusChange(true);
    }
  };

  React.useEffect(() => {
    if (isMultiplayer) {
      const handleOpponentDisconnected = () => {
        alert(t('Opponent disconnected or left! Match ended.'));
        onExit();
      };
      
      socket.on('opponent_disconnected', handleOpponentDisconnected);

      const handleMatchEndedPayload = (payload: { reason: string; winner: 'left' | 'right' | null }) => {
        if (payload.reason === 'completed') {
          setMatchStatus('finished');
          setWinner(payload.winner);
          if (onStatusChange) onStatusChange(true);
        } else {
          handleOpponentDisconnected();
        }
      };

      const handleRestartMatch = () => {
        setMatchStatus('playing');
        setWinner(null);
        setRematchRequested(false);
        setRematchCount((c) => c + 1);
        if (onStatusChange) onStatusChange(false);
      };

      socket.on('match_ended', handleMatchEndedPayload);
      socket.on('restart_match', handleRestartMatch);
      
      return () => {
        socket.off('opponent_disconnected', handleOpponentDisconnected);
        socket.off('match_ended', handleMatchEndedPayload);
        socket.off('restart_match', handleRestartMatch);
      };
    }
  }, [isMultiplayer, onExit, t]);



  return (
    <div className="game-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', flex: 1, padding: '10px 0' }}>
      <div className="glass-panel" style={{ position: 'relative', padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: '800px', overflow: 'hidden' }}>
        <PongCanvas key={rematchCount} isMultiplayer={isMultiplayer} side={multiplayerSide} roomId={roomId} onMatchEnded={handleMatchEndedEngine} settings={settings} />
        
        {matchStatus === 'finished' && winner && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', zIndex: 10, borderRadius: '16px',
            backdropFilter: 'blur(5px)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 className="title-glow" style={{ fontSize: '3.5rem', margin: '0 0 10px 0', letterSpacing: '4px' }}>
                🏆 {t('WINNER')} 🏆
              </h2>
              <h3 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--text-main)', fontWeight: 600 }}>
                {winner === 'left' ? t('PLAYER 1') : t('PLAYER 2')}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <button 
                className="btn-premium secondary" 
                onClick={() => {
                  if (isMultiplayer) {
                    import('../game/socket').then(m => m.socket.emit('leave_match'));
                  }
                  onExit();
                }}
              >
                {t('EXIT TO MENU')}
              </button>
              <button 
                className="btn-premium" 
                onClick={() => {
                  if (isMultiplayer) {
                    import('../game/socket').then(m => m.socket.emit('play_again_request'));
                    setRematchRequested(true);
                  } else {
                    setMatchStatus('playing');
                    setWinner(null);
                    setRematchCount(c => c + 1);
                    if (onStatusChange) onStatusChange(false);
                  }
                }}
                disabled={rematchRequested}
                style={{ opacity: rematchRequested ? 0.6 : 1 }}
              >
                {rematchRequested ? t('WAITING FOR OPPONENT') : t('NEW GAME')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '800px', marginTop: '0.5rem', padding: '0 10px' }}>
        <div style={{ textAlign: 'center' }}>
          <h3>{isMultiplayer ? t('PLAYER 1') : t('PLAYER 1') + ' (AI)'}</h3>
          <p style={{ color: 'var(--text-muted)' }}>{isMultiplayer ? t('W / S to move') : ''}</p>
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
