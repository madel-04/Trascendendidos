import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { socket, syncSocketAuthToken } from "../game/socket";

interface MatchmakingProps {
  onMatchFound: (roomId: string, side: "left" | "right") => void;
  onCancel: () => void;
}

export default function Matchmaking({ onMatchFound, onCancel }: MatchmakingProps) {
  const { t } = useTranslation();

  useEffect(() => {
    syncSocketAuthToken();

    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      socket.emit("join_matchmaking");
    };

    const handleMatchFound = (payload: { roomId: string; side: "left" | "right" }) => {
      onMatchFound(payload.roomId, payload.side);
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.on("connect", handleConnect);
    }

    socket.on("match_found", handleMatchFound);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("match_found", handleMatchFound);
    };
  }, [onMatchFound]);

  const handleLeave = () => {
    socket.emit("leave_matchmaking");
    onCancel();
  };

  return (
    <div className="glass-panel" style={{ textAlign: "center", padding: "2rem" }}>
      <h2 className="title-glow">{t("MATCHMAKING...")}</h2>
      <p>{t("Searching for an opponent in the queue")}</p>
      <div style={{ marginTop: "2rem" }}>
        <div
          className="spinner"
          style={{
            margin: "0 auto 2rem",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "4px solid var(--accent-cyan)",
            borderTopColor: "transparent",
            animation: "spin 1s linear infinite",
          }}
        />
        <button className="btn-premium secondary" onClick={handleLeave}>
          {t("CANCEL")}
        </button>
      </div>
      <style>{"@keyframes spin { 100% { transform: rotate(360deg); } }"}</style>
    </div>
  );
}
