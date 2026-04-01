// ===== PÁGINA DEL JUEGO =====
// Esta página contiene el canvas 3D con el juego Pong

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Importamos el componente que renderiza la escena 3D con Three.js
import ThreeCanvas from "../three/ThreeCanvas";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

function toWsBaseUrl(httpBase: string): string {
  if (httpBase.startsWith("https://")) {
    return `wss://${httpBase.slice("https://".length)}`;
  }
  if (httpBase.startsWith("http://")) {
    return `ws://${httpBase.slice("http://".length)}`;
  }
  return httpBase;
}

type GameRoomStatus = {
  roomId: string;
  status: "waiting" | "ready" | "started";
  players: {
    you: {
      playerId: number;
      ready: boolean;
    };
    opponent: {
      playerId: number;
      username: string;
      ready: boolean;
    };
  };
  gameStarted: boolean;
};

export default function Play() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(localStorage.getItem("token") ?? null);
  const [roomStatus, setRoomStatus] = useState<GameRoomStatus | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const matchContext = useMemo(() => {
    const roomId = searchParams.get("roomId")?.trim() || "";
    const opponent = searchParams.get("opponent")?.trim() || "";
    const source = searchParams.get("source")?.trim() || "";

    if (!roomId || source !== "invite") {
      return null;
    }

    return { roomId, opponent };
  }, [searchParams]);

  // Join game room when component mounts or roomId changes
  const joinRoom = useCallback(async () => {
    if (!matchContext || !token) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API}/api/game/room/${encodeURIComponent(matchContext.roomId)}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Error al unirse a la sala" });
        return;
      }

      // Fetch room status after joining
      const statusResponse = await fetch(
        `${API}/api/game/room/${encodeURIComponent(matchContext.roomId)}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const statusData: GameRoomStatus = await statusResponse.json();
      if (statusResponse.ok) {
        setRoomStatus(statusData);
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error de conexión al unirse a la sala" });
    } finally {
      setLoading(false);
    }
  }, [matchContext, token]);

  // Join room on mount
  useEffect(() => {
    void joinRoom();
  }, [joinRoom]);

  // Poll room status periodically
  useEffect(() => {
    if (!matchContext || !token || roomStatus?.gameStarted) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${API}/api/game/room/${encodeURIComponent(matchContext.roomId)}/status`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data: GameRoomStatus = await response.json();
          setRoomStatus(data);
        }
      } catch (_error) {
        // Silent fail
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [matchContext, token, roomStatus?.gameStarted]);

  // WebSocket listener for real-time updates
  useEffect(() => {
    if (!token || !matchContext) return;

    const ws = new WebSocket(`${toWsBaseUrl(API)}/ws?token=${encodeURIComponent(token)}`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.channel !== "social") return;

        // Update room status on relevant events
        if (
          payload.event === "game_player_ready" ||
          payload.event === "game_start"
        ) {
          if (payload.data?.roomId === matchContext.roomId) {
            // Refetch status
            fetch(
              `${API}/api/game/room/${encodeURIComponent(matchContext.roomId)}/status`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            )
              .then((res) => res.json())
              .then((data: GameRoomStatus) => {
                setRoomStatus(data);
              })
              .catch(() => {});
          }
        }
      } catch (_error) {
        // Ignore non-JSON
      }
    };

    return () => {
      ws.close();
    };
  }, [token, matchContext]);

  const markReady = async () => {
    if (!matchContext || !token || isReady) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(
        `${API}/api/game/room/${encodeURIComponent(matchContext.roomId)}/ready`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Error al marcar listo" });
        return;
      }

      setIsReady(true);
      setMessage({ type: "success", text: "¡Estás listo para jugar!" });

      // Update room status
      if (data.gameStarted) {
        setRoomStatus((prev) =>
          prev
            ? { ...prev, gameStarted: true, status: "started" as const }
            : null
        );
      }
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Título de la página */}
      <h2>Play</h2>
      {/* Descripción de lo que contiene */}
      <p>Three.js bootstrap (mesa + palas + bola).</p>

      {matchContext ? (
        <>
          {message && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                border: `1px solid ${message.type === "success" ? "#2ecc71" : "#e74c3c"}`,
                backgroundColor: message.type === "success" ? "#f0fdf4" : "#fef2f2",
                color: message.type === "success" ? "#16a34a" : "#dc2626",
                fontSize: 13,
                borderRadius: 6,
              }}
            >
              {message.text}
            </div>
          )}

          {roomStatus ? (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 10,
                background: "#fafafa",
                display: "grid",
                gap: 8,
              }}
            >
              <div>
                <strong style={{ display: "block", marginBottom: 4 }}>
                  Partida por invitación
                </strong>
                <span style={{ display: "block", fontSize: 13, color: "#666" }}>
                  Room: {roomStatus.roomId}
                </span>
                <span style={{ display: "block", fontSize: 13, color: "#666" }}>
                  Rival: @{roomStatus.players.opponent.username}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 6,
                  fontSize: 13,
                  borderTop: "1px solid #ddd",
                  paddingTop: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Tu estado:</span>
                  <span
                    style={{
                      fontWeight: "bold",
                      color: roomStatus.players.you.ready ? "#2ecc71" : "#f39c12",
                    }}
                  >
                    {roomStatus.players.you.ready ? "✓ Listo" : "⏳ Esperando"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Estado del rival:</span>
                  <span
                    style={{
                      fontWeight: "bold",
                      color: roomStatus.players.opponent.ready ? "#2ecc71" : "#f39c12",
                    }}
                  >
                    {roomStatus.players.opponent.ready ? "✓ Listo" : "⏳ Esperando"}
                  </span>
                </div>
              </div>

              {!roomStatus.gameStarted && !roomStatus.players.you.ready && (
                <button
                  onClick={() => void markReady()}
                  disabled={loading}
                  style={{
                    padding: "10px 16px",
                    border: "1px solid #111",
                    backgroundColor: "#111",
                    color: "white",
                    cursor: loading ? "not-allowed" : "pointer",
                    borderRadius: 6,
                    fontWeight: "bold",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Procesando..." : "Marcar Listo"}
                </button>
              )}

              {roomStatus.gameStarted && (
                <div
                  style={{
                    padding: 10,
                    backgroundColor: "#2ecc71",
                    color: "white",
                    borderRadius: 6,
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  ¡La partida ha comenzado! 🎮
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                border: "1px solid #f39c12",
                borderRadius: 10,
                background: "#fffbf0",
                color: "#b8860b",
                fontSize: 13,
              }}
            >
              {loading ? "Uniéndose a la sala..." : "Preparando la partida..."}
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#f9f9f9",
            color: "#666",
          }}
        >
          <p style={{ margin: 0, fontSize: 13 }}>
            No hay partida en curso. Ve a Social para invitar a un amigo o acepta una invitación.
          </p>
        </div>
      )}

      {/* Contenedor del canvas 3D con estilos personalizados */}
      {/* height: 520px → Altura fija para el canvas */}
      {/* borderRadius: 12 → Esquinas redondeadas */}
      {/* overflow: hidden → Corta contenido que salga del contenedor */}
      {/* border: Borde sutil para delimitar el área de juego */}
      {roomStatus?.gameStarted ? (
        <div
          style={{
            height: 520,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #222",
          }}
        >
          {/* Componente que crea y anima la escena 3D */}
          <ThreeCanvas />
        </div>
      ) : (
        <div
          style={{
            height: 520,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #ddd",
            background: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
          }}
        >
          <span style={{ fontSize: 14, textAlign: "center" }}>
            Canvas habilitado cuando ambos jugadores estén listos
          </span>
        </div>
      )}
    </div>
  );
}