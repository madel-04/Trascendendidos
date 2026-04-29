import React from 'react';
import PongCanvas, { type PongCanvasHandle } from './PongCanvas';
import { socket, syncSocketAuthToken } from '../game/socket';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { recordLocalBotMatch } from '../utils/localGameStats';

interface GameViewProps {
  onExit: () => void;
  isMultiplayer?: boolean;
  multiplayerSide?: 'left' | 'right';
  roomId?: string;
  joinInviteRoom?: boolean;
  waitForRealtimeReady?: boolean;
  allowRematch?: boolean;
  exitLabel?: string;
  onStatusChange?: (finished: boolean) => void;
  settings?: { targetScore: number; difficulty: string };
  localControlMode?: 'keyboard' | 'mouse';
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(0,0,0,0.85)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10,
  borderRadius: '16px',
  backdropFilter: 'blur(5px)',
};

const GameView: React.FC<GameViewProps> = ({ onExit, isMultiplayer, multiplayerSide, roomId, joinInviteRoom, waitForRealtimeReady, allowRematch = true, exitLabel, onStatusChange, settings, localControlMode = 'keyboard' }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canvasRef = React.useRef<PongCanvasHandle | null>(null);
  const [matchStatus, setMatchStatus] = React.useState<'playing' | 'finished'>('playing');
  const [winner, setWinner] = React.useState<'left' | 'right' | null>(null);
  const [rematchRequested, setRematchRequested] = React.useState(false);
  const [rematchCount, setRematchCount] = React.useState(0);
  const [realtimeReady, setRealtimeReady] = React.useState(!waitForRealtimeReady);
  const [isPaused, setIsPaused] = React.useState(false);
  const localResultRecorded = React.useRef(false);
  const isLocalMatch = !isMultiplayer;

  const closePauseMenu = React.useCallback(() => {
    if (!isLocalMatch || matchStatus !== 'playing') {
      return;
    }

    canvasRef.current?.resume();
    setIsPaused(false);
  }, [isLocalMatch, matchStatus]);

  const openPauseMenu = React.useCallback(() => {
    if (!isLocalMatch || matchStatus !== 'playing') {
      return;
    }

    canvasRef.current?.pause();
    setIsPaused(true);
  }, [isLocalMatch, matchStatus]);

  const togglePauseMenu = React.useCallback(() => {
    if (isPaused) {
      closePauseMenu();
    } else {
      openPauseMenu();
    }
  }, [closePauseMenu, isPaused, openPauseMenu]);

  const handleMatchEndedEngine = React.useCallback((winSide: 'left' | 'right') => {
    if (!isMultiplayer) {
      if (!localResultRecorded.current) {
        recordLocalBotMatch(user?.id, winSide, settings, localControlMode);
        localResultRecorded.current = true;
      }
      setIsPaused(false);
      setMatchStatus('finished');
      setWinner(winSide);
      if (onStatusChange) onStatusChange(true);
    }
  }, [isMultiplayer, localControlMode, onStatusChange, settings, user?.id]);

  React.useEffect(() => {
    setRealtimeReady(!waitForRealtimeReady);
  }, [waitForRealtimeReady, roomId]);

  React.useEffect(() => {
    if (!isLocalMatch || matchStatus !== 'playing') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      togglePauseMenu();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocalMatch, matchStatus, togglePauseMenu]);

  React.useEffect(() => {
    if (matchStatus === 'finished' && isPaused) {
      setIsPaused(false);
    }
  }, [isPaused, matchStatus]);

  React.useEffect(() => {
    if (isMultiplayer) {
      syncSocketAuthToken();
      if (!socket.connected) {
        socket.connect();
      }
      if (joinInviteRoom && roomId) {
        socket.emit('join_invite_match', { roomId });
      }

      const handleOpponentDisconnected = () => {
        alert(t('Opponent disconnected or left! Match ended.'));
        onExit();
      };

      const handleReturnHome = () => {
        onExit();
      };

      const handleInviteMatchReady = () => {
        setRealtimeReady(true);
      };

      socket.on('opponent_disconnected', handleOpponentDisconnected);
      socket.on('returned_to_home', handleReturnHome);
      socket.on('invite_match_ready', handleInviteMatchReady);

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
        socket.off('returned_to_home', handleReturnHome);
        socket.off('invite_match_ready', handleInviteMatchReady);
        socket.off('match_ended', handleMatchEndedPayload);
        socket.off('restart_match', handleRestartMatch);
      };
    }
  }, [isMultiplayer, joinInviteRoom, onExit, roomId, t, onStatusChange]);

  const handleExit = () => {
    if (isMultiplayer) {
      socket.emit(matchStatus === 'finished' ? 'leave_completed_match' : 'leave_match');
    }
    onExit();
  };

  return (
    <div className="game-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', flex: 1, padding: '10px 0' }}>
      <div className="glass-panel" style={{ position: 'relative', padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: '800px', overflow: 'hidden' }}>
        {realtimeReady ? (
          <PongCanvas
            key={rematchCount}
            ref={canvasRef}
            isMultiplayer={isMultiplayer}
            side={multiplayerSide}
            roomId={roomId}
            onMatchEnded={handleMatchEndedEngine}
            settings={settings}
            localControlMode={localControlMode}
          />
        ) : (
          <div style={{ minHeight: 520, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
            <span>Esperando a que ambos jugadores sincronicen la partida...</span>
          </div>
        )}

        {isLocalMatch && matchStatus === 'playing' && realtimeReady && (
          <button
            type="button"
            className="btn-premium secondary"
            onClick={togglePauseMenu}
            style={{ position: 'absolute', top: 20, right: 20, zIndex: 9, minWidth: 110 }}
          >
            {t('PAUSE')}
          </button>
        )}

        {isPaused && matchStatus === 'playing' && (
          <div style={overlayStyle}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h2 className="title-glow" style={{ fontSize: '3rem', margin: '0 0 10px 0', letterSpacing: '4px' }}>
                {t('PAUSED')}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t('Press ESC to continue')}</p>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn-premium" onClick={closePauseMenu}>
                {t('RESUME')}
              </button>
              <button className="btn-premium secondary" onClick={handleExit}>
                {exitLabel ?? t('EXIT TO MENU')}
              </button>
            </div>
          </div>
        )}

        {matchStatus === 'finished' && winner && (
          <div style={overlayStyle}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 className="title-glow" style={{ fontSize: '3.5rem', margin: '0 0 10px 0', letterSpacing: '4px' }}>
                {t('WINNER')}
              </h2>
              <h3 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--text-main)', fontWeight: 600 }}>
                {winner === 'left' ? t('PLAYER 1') : t('PLAYER 2')}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <button
                className="btn-premium secondary"
                onClick={() => {
                  handleExit();
                }}
              >
                {exitLabel ?? t('EXIT TO MENU')}
              </button>
              {allowRematch ? (
                <button
                  className="btn-premium"
                  onClick={() => {
                    setIsPaused(false);
                    if (isMultiplayer) {
                      socket.emit('play_again_request');
                      setRematchRequested(true);
                    } else {
                      localResultRecorded.current = false;
                      setMatchStatus('playing');
                      setWinner(null);
                      setRematchCount((c) => c + 1);
                      if (onStatusChange) onStatusChange(false);
                    }
                  }}
                  disabled={rematchRequested}
                  style={{ opacity: rematchRequested ? 0.6 : 1 }}
                >
                  {rematchRequested ? t('WAITING FOR OPPONENT') : t('NEW GAME')}
                </button>
              ) : null}
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
          <p style={{ color: 'var(--text-muted)' }}>{!isMultiplayer && localControlMode === 'mouse' ? t('Mouse to move') : t('Up / Down to move')}</p>
        </div>
      </div>
    </div>
  );
};

export default GameView;
