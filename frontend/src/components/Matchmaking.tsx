import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { socket } from '../game/socket';

interface MatchmakingProps {
  onMatchFound: (roomId: string, side: 'left' | 'right') => void;
  onCancel: () => void;
}

const Matchmaking: React.FC<MatchmakingProps> = ({ onMatchFound, onCancel }) => {
  const { t } = useTranslation();

  useEffect(() => {
    // Connect to server
    if (!socket.connected) {
      socket.connect();
    }

    // Join matchmaking once connected
    const handleConnect = () => {
      socket.emit('join_matchmaking');
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.on('connect', handleConnect);
    }

    const handleMatchFound = (payload: { roomId: string; side: 'left' | 'right' }) => {
      onMatchFound(payload.roomId, payload.side);
    };

    socket.on('match_found', handleMatchFound);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('match_found', handleMatchFound);
    };
  }, [onMatchFound]);

  const handleLeave = () => {
    socket.emit('leave_matchmaking');
    onCancel();
  };

  return (
    <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
      <h2 className="title-glow">{t('MATCHMAKING...')}</h2>
      <p>{t('Searching for an opponent in the queue')}</p>
      <div style={{ marginTop: '2rem' }}>
        <div className="spinner" style={{ margin: '0 auto 2rem', width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <button className="btn-premium secondary" onClick={handleLeave}>
          {t('CANCEL')}
        </button>
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Matchmaking;
