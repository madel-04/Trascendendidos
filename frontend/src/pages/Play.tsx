// ===== PÁGINA DEL JUEGO =====
// Esta página contiene el canvas 3D con el juego Pong

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

// Importamos el componente que renderiza la escena 3D con Three.js
import ThreeCanvas from "../three/ThreeCanvas";
import MainMenu from "../components/MainMenu";
import GameView from "../components/GameView";
import Matchmaking from "../components/Matchmaking";
import SettingsPanel from "../components/SettingsPanel";
import { useAuth } from "../context/AuthContext";

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

type LocalControlMode = "keyboard" | "mouse";

function KeyboardArrowsIcon() {
  return (
    <svg width="118" height="82" viewBox="0 0 118 82" role="img" aria-hidden="true" focusable="false">
      <rect x="39" y="4" width="40" height="34" rx="8" fill="rgba(0,240,255,0.16)" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="44" width="34" height="34" rx="8" fill="rgba(255,255,255,0.08)" stroke="currentColor" strokeWidth="2" />
      <rect x="42" y="44" width="34" height="34" rx="8" fill="rgba(0,240,255,0.16)" stroke="currentColor" strokeWidth="2" />
      <rect x="80" y="44" width="34" height="34" rx="8" fill="rgba(255,255,255,0.08)" stroke="currentColor" strokeWidth="2" />
      <path d="M59 14l-9 12h18L59 14zM21 61l10-8v16l-10-8zM59 68l9-12H50l9 12zM97 61l-10-8v16l10-8z" fill="currentColor" />
    </svg>
  );
}

function MouseControlIcon() {
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-hidden="true" focusable="false">
      <rect x="23" y="6" width="46" height="80" rx="23" fill="rgba(255,0,60,0.13)" stroke="currentColor" strokeWidth="3" />
      <path d="M46 7v27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="41" y="17" width="10" height="18" rx="5" fill="currentColor" />
      <path d="M18 74c-7-5-11-12-11-20M74 74c7-5 11-12 11-20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export default function Play() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { token } = useAuth();
  const [roomStatus, setRoomStatus] = useState<GameRoomStatus | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [localView, setLocalView] = useState<"menu" | "controls" | "game" | "lobby" | "settings">("menu");
  const [settings, setSettings] = useState({ targetScore: 5, difficulty: "Beginner" });
  const [localControlMode, setLocalControlMode] = useState<LocalControlMode>("keyboard");
  const [isMatchFinished, setIsMatchFinished] = useState(false);
  const [multiplayerState, setMultiplayerState] = useState<{ roomId: string; side: "left" | "right" } | null>(null);
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

  if (!matchContext) {
    return (
      <div className="app-container">
        {localView === "menu" && (
          <MainMenu
            onStartGame={() => {
              setMultiplayerState(null);
              setIsMatchFinished(false);
              setLocalView("controls");
            }}
            onStartMultiplayer={() => {
              setMultiplayerState(null);
              setIsMatchFinished(false);
              setLocalView("lobby");
            }}
            onOpenSettings={() => setLocalView("settings")}
          />
        )}
        {localView === "settings" && (
          <SettingsPanel
            currentSettings={settings}
            onSave={(nextSettings) => {
              setSettings(nextSettings);
              setLocalView("menu");
            }}
            onCancel={() => setLocalView("menu")}
          />
        )}
        {localView === "controls" && (
          <div className="glass-panel" style={{ width: "min(100%, 720px)", padding: "clamp(1.25rem, 4vw, 2rem)", display: "grid", gap: "1.25rem", textAlign: "center" }}>
            <div>
              <h2 className="title-glow" style={{ marginBottom: 8 }}>{t("CHOOSE CONTROLS")}</h2>
              <p style={{ color: "var(--text-muted)", margin: 0 }}>
                {t("Choose how you want to move your paddle before starting the local match.")}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <button
                className="btn-premium"
                type="button"
                style={{ display: "grid", justifyItems: "center", gap: 10, minHeight: 190, alignContent: "center" }}
                onClick={() => {
                  setLocalControlMode("keyboard");
                  setLocalView("game");
                }}
              >
                <KeyboardArrowsIcon />
                <span>{t("ARROW KEYS")}</span>
                <small style={{ color: "var(--text-muted)", letterSpacing: 0, textTransform: "none", fontFamily: "var(--font-main)", fontWeight: 400 }}>
                  {t("Use the keyboard arrows to move up and down.")}
                </small>
              </button>
              <button
                className="btn-premium secondary"
                type="button"
                style={{ display: "grid", justifyItems: "center", gap: 10, minHeight: 190, alignContent: "center" }}
                onClick={() => {
                  setLocalControlMode("mouse");
                  setLocalView("game");
                }}
              >
                <MouseControlIcon />
                <span>{t("MOUSE")}</span>
                <small style={{ color: "var(--text-muted)", letterSpacing: 0, textTransform: "none", fontFamily: "var(--font-main)", fontWeight: 400 }}>
                  {t("Move the mouse over the court to control the paddle.")}
                </small>
              </button>
            </div>
            <button className="btn-premium tertiary" type="button" onClick={() => setLocalView("menu")}>
              {t("BACK")}
            </button>
          </div>
        )}
        {localView === "lobby" && (
          <Matchmaking
            onMatchFound={(roomId, side) => {
              setMultiplayerState({ roomId, side });
              setIsMatchFinished(false);
              setLocalView("game");
            }}
            onCancel={() => setLocalView("menu")}
          />
        )}
        {localView === "game" && (
          <GameView
            onExit={() => {
              setMultiplayerState(null);
              setIsMatchFinished(false);
              setLocalView("menu");
            }}
            isMultiplayer={!!multiplayerState}
            multiplayerSide={multiplayerState?.side}
            roomId={multiplayerState?.roomId}
            onStatusChange={setIsMatchFinished}
            settings={settings}
            localControlMode={localControlMode}
          />
        )}
      </div>
    );
  }

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
                border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.7)" : "rgba(255, 77, 103, 0.7)"}`,
                backgroundColor: message.type === "success" ? "rgba(34, 197, 94, 0.12)" : "rgba(255, 77, 103, 0.12)",
                color: message.type === "success" ? "#9bf2bd" : "#ff8da1",
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
                border: "1px solid rgba(255, 255, 255, 0.16)",
                borderRadius: 10,
                background: "rgba(10, 12, 24, 0.86)",
                display: "grid",
                gap: 8,
              }}
            >
              <div>
                <strong style={{ display: "block", marginBottom: 4 }}>
                  Partida por invitación
                </strong>
                <span style={{ display: "block", fontSize: 13, color: "var(--ink-muted)" }}>
                  Room: {roomStatus.roomId}
                </span>
                <span style={{ display: "block", fontSize: 13, color: "var(--ink-muted)" }}>
                  Rival: @{roomStatus.players.opponent.username}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 6,
                  fontSize: 13,
                  borderTop: "1px solid rgba(255, 255, 255, 0.12)",
                  paddingTop: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Tu estado:</span>
                  <span
                    style={{
                      fontWeight: "bold",
                      color: roomStatus.players.you.ready ? "#22c55e" : "#ff9c33",
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
                      color: roomStatus.players.opponent.ready ? "#22c55e" : "#ff9c33",
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
                    border: "1px solid rgba(0, 240, 255, 0.55)",
                    backgroundColor: "rgba(0, 240, 255, 0.16)",
                    color: "#9ef8ff",
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
                    backgroundColor: "rgba(34, 197, 94, 0.22)",
                    color: "#9bf2bd",
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
                border: "1px solid rgba(255, 156, 51, 0.7)",
                borderRadius: 10,
                background: "rgba(255, 156, 51, 0.12)",
                color: "#ffb866",
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
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: 10,
            background: "rgba(8, 10, 20, 0.78)",
            color: "var(--ink-muted)",
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
            border: "1px solid rgba(0, 240, 255, 0.28)",
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
            border: "1px solid rgba(255, 255, 255, 0.14)",
            background: "rgba(8, 10, 20, 0.86)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink-muted)",
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
