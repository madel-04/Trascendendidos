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
    <div className="game-container">
      <div className="glass-panel game-stage">
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
          <div className="game-sync-wait">
            <span>Esperando a que ambos jugadores sincronicen la partida...</span>
          </div>
        )}

        {isLocalMatch && matchStatus === 'playing' && realtimeReady && (
          <button
            type="button"
            onClick={togglePauseMenu}
            className="btn-premium secondary game-pause-button"
          >
            {t('PAUSE')}
          </button>
        )}

        {isPaused && matchStatus === 'playing' && (
          <div className="game-overlay">
            <div className="game-overlay-content">
              <h2 className="title-glow game-overlay-title">
                {t('PAUSED')}
              </h2>
              <p className="game-overlay-text">{t('Press ESC to continue')}</p>
            </div>
            <div className="game-overlay-actions">
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
          <div className="game-overlay">
            <div className="game-overlay-content" style={{ marginBottom: '2rem' }}>
              <h2 className="title-glow game-overlay-title game-winner-title">
                {t('WINNER')}
              </h2>
              <h3 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--text-main)', fontWeight: 600 }}>
                {winner === 'left' ? t('PLAYER 1') : t('PLAYER 2')}
              </h3>
            </div>
            <div className="game-overlay-actions">
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

      <div className="game-meta">
        <div className="game-meta-card">
          <h3>{isMultiplayer ? t('PLAYER 1') : t('PLAYER 1') + ' (AI)'}</h3>
          <p style={{ color: 'var(--text-muted)' }}>{isMultiplayer ? t('W / S to move') : ''}</p>
        </div>
        <div className="game-meta-card">
          <h3>{t('PLAYER 2')}</h3>
          <p style={{ color: 'var(--text-muted)' }}>{!isMultiplayer && localControlMode === 'mouse' ? t('Mouse to move') : t('Up / Down to move')}</p>
        </div>
      </div>
    </div>
  );
};

export default GameView;
