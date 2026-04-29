import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { socket, syncSocketAuthToken } from "../game/socket";

interface MatchmakingProps {
  onMatchFound: (roomId: string, side: "left" | "right") => void;
  onCancel: () => void;
}

export default function Matchmaking({ onMatchFound, onCancel }: MatchmakingProps) {
  const { t } = useTranslation();
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    syncSocketAuthToken();

    const handleConnect = () => {
      setConnectionError(null);
      socket.emit("join_matchmaking");
    };

    const handleWaiting = () => {
      setConnectionError(null);
    };

    const handleMatchFound = (payload: { roomId: string; side: "left" | "right" }) => {
      onMatchFound(payload.roomId, payload.side);
    };

    const handleConnectError = (error: Error) => {
      const reason = error.message === "auth_required" || error.message === "auth_invalid"
        ? "Sesion no valida. Vuelve a iniciar sesion."
        : `No se pudo conectar con matchmaking: ${error.message}`;
      setConnectionError(reason);
    };

    const handleMatchmakingError = (payload: { message?: string }) => {
      setConnectionError(payload.message || "No se pudo entrar en la cola.");
    };

    socket.on("connect", handleConnect);
    socket.on("waiting_for_opponent", handleWaiting);
    socket.on("match_found", handleMatchFound);
    socket.on("connect_error", handleConnectError);
    socket.on("matchmaking_error", handleMatchmakingError);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("waiting_for_opponent", handleWaiting);
      socket.off("match_found", handleMatchFound);
      socket.off("connect_error", handleConnectError);
      socket.off("matchmaking_error", handleMatchmakingError);
      socket.emit("leave_matchmaking");
    };
  }, [onMatchFound]);

  const handleLeave = () => {
    socket.emit("leave_matchmaking");
    onCancel();
  };

  return (
    <div className="glass-panel matchmaking-panel">
      <div>
      <h2 className="title-glow">{t("MATCHMAKING...")}</h2>
      <p>{t("Searching for an opponent in the queue")}</p>
      {connectionError && (
        <p style={{ color: "var(--accent-magenta)", marginTop: "0.75rem" }}>
          {connectionError}
        </p>
      )}
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
      </div>
      <style>{"@keyframes spin { 100% { transform: rotate(360deg); } }"}</style>
    </div>
  );
}
