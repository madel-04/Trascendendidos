import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

type PanelMessage = { type: "success" | "error"; text: string } | null;

type PublicUser = {
  id: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

type FriendItem = {
  user: PublicUser;
  since: string;
};

type RequestItem = {
  requestId: number;
  user: PublicUser;
  createdAt: string;
};

type BlockItem = {
  user: PublicUser;
  createdAt: string;
};

type SocialOverview = {
  friends: FriendItem[];
  incomingRequests: RequestItem[];
  outgoingRequests: RequestItem[];
  blocks: BlockItem[];
};

type ChatMessage = {
  id: string;
  fromUserId: number;
  toUserId: number;
  content: string;
  createdAt: string;
};

type MatchInvite = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
  roomId?: string | null;
  user: PublicUser;
};

type MatchInviteResponse = {
  incoming: MatchInvite[];
  outgoing: MatchInvite[];
};

type MatchInviteActionResponse = {
  message?: string;
  inviteId?: string;
  roomId?: string;
  opponentUsername?: string;
  error?: string;
};

type InAppNotification = {
  id: string;
  text: string;
  createdAt: number;
};

const EMPTY_OVERVIEW: SocialOverview = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  blocks: [],
};

function displayUserName(user: PublicUser): string {
  return user.displayName?.trim() ? `${user.displayName} (@${user.username})` : `@${user.username}`;
}

export default function SocialPanel({ token }: { token: string | null }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<SocialOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<PanelMessage>(null);
  const [friendUsername, setFriendUsername] = useState("");
  const [blockUsername, setBlockUsername] = useState("");
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<MatchInvite[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<MatchInvite[]>([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [chatTarget, setChatTarget] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const friendUsernames = useMemo(
    () => overview.friends.map((friend) => friend.user.username),
    [overview.friends]
  );

  const pushNotification = useCallback((text: string) => {
    setNotifications((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        createdAt: Date.now(),
      },
      ...prev,
    ].slice(0, 30));
  }, []);

  const fetchOverview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/social/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo cargar la informacion social" });
        return;
      }
      setOverview(data);
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al cargar datos sociales" });
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchInvites = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API}/api/match/invites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: MatchInviteResponse = await response.json();
      if (!response.ok) return;
      setIncomingInvites(data.incoming ?? []);
      setOutgoingInvites(data.outgoing ?? []);
    } catch (_error) {
      // Silent refresh fail; user-facing errors shown on explicit actions.
    }
  }, [token]);

  const loadConversation = useCallback(async (targetUsername: string) => {
    if (!token || !targetUsername.trim()) return;
    setChatLoading(true);
    try {
      const response = await fetch(
        `${API}/api/chat/conversation/${encodeURIComponent(targetUsername.trim())}/messages?limit=80`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo cargar la conversacion" });
        return;
      }
      setChatMessages(data.messages ?? []);
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al cargar chat" });
    } finally {
      setChatLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOverview();
    fetchInvites();
  }, [fetchInvites, fetchOverview]);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${toWsBaseUrl(API)}/ws?token=${encodeURIComponent(token)}`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.channel !== "social") return;

        const messages: Record<string, string> = {
          friend_request_received: "Tienes una nueva solicitud de amistad",
          friend_request_sent: "Solicitud de amistad enviada",
          friend_request_accepted: "Una solicitud de amistad fue aceptada",
          friend_request_rejected: "Una solicitud de amistad fue rechazada",
          user_blocked_you: "Has sido bloqueado por un usuario",
          user_unblocked_you: "Un usuario te ha desbloqueado",
          you_blocked_user: "Usuario bloqueado",
          you_unblocked_user: "Usuario desbloqueado",
          chat_message_received: "Nuevo mensaje de chat",
          match_invite_received: "Tienes una nueva invitacion de partida",
          match_invite_sent: "Invitacion de partida enviada",
          match_invite_accepted: "Tu invitacion de partida fue aceptada",
          match_invite_rejected: "Tu invitacion de partida fue rechazada",
        };

        if (messages[payload.event]) {
          setMessage({ type: "success", text: messages[payload.event] });
          pushNotification(messages[payload.event]);
        }
        void fetchOverview();
        void fetchInvites();

        if (payload.event === "chat_message_received" && payload.data?.fromUserId && chatTarget.trim().length > 0) {
          void loadConversation(chatTarget);
        }
      } catch (_error) {
        // Ignore non-JSON server messages.
      }
    };

    ws.onerror = () => {
      setMessage({ type: "error", text: "No se pudo establecer canal en tiempo real" });
    };

    return () => {
      ws.close();
    };
  }, [chatTarget, fetchInvites, fetchOverview, loadConversation, pushNotification, token]);

  const sendFriendRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/social/friend-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: friendUsername.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo enviar la solicitud" });
        return;
      }
      setFriendUsername("");
      setMessage({ type: "success", text: "Solicitud enviada" });
      await fetchOverview();
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al enviar la solicitud" });
    } finally {
      setActionLoading(false);
    }
  };

  const blockUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/social/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: blockUsername.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo bloquear al usuario" });
        return;
      }
      setBlockUsername("");
      setMessage({ type: "success", text: "Usuario bloqueado correctamente" });
      await fetchOverview();
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al bloquear usuario" });
    } finally {
      setActionLoading(false);
    }
  };

  const respondToRequest = async (requestId: number, action: "accept" | "reject") => {
    if (!token) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/social/friend-request/${requestId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo actualizar la solicitud" });
        return;
      }
      setMessage({ type: "success", text: action === "accept" ? "Solicitud aceptada" : "Solicitud rechazada" });
      await fetchOverview();
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al procesar solicitud" });
    } finally {
      setActionLoading(false);
    }
  };

  const unblockUser = async (username: string) => {
    if (!token) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/social/block/${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo desbloquear al usuario" });
        return;
      }
      setMessage({ type: "success", text: "Usuario desbloqueado" });
      await fetchOverview();
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al desbloquear" });
    } finally {
      setActionLoading(false);
    }
  };

  const blockFriend = async (username: string) => {
    if (!token) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/social/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo bloquear al usuario" });
        return;
      }
      setMessage({ type: "success", text: "Usuario bloqueado" });
      await fetchOverview();
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al bloquear" });
    } finally {
      setActionLoading(false);
    }
  };

  const sendMatchInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/match/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: inviteUsername.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo enviar la invitacion" });
        return;
      }
      setInviteUsername("");
      setMessage({ type: "success", text: "Invitacion de partida enviada" });
      await fetchInvites();
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al invitar partida" });
    } finally {
      setActionLoading(false);
    }
  };

  const respondInvite = async (inviteId: string, action: "accept" | "reject") => {
    if (!token) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/match/invite/${inviteId}/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data: MatchInviteActionResponse = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo responder la invitacion" });
        return;
      }

      if (action === "accept" && data.roomId && data.opponentUsername) {
        const params = new URLSearchParams({
          roomId: data.roomId,
          opponent: data.opponentUsername,
          source: "invite",
        });
        navigate(`/play?${params.toString()}`);
      }

      setMessage({ type: "success", text: action === "accept" ? "Invitacion aceptada" : "Invitacion rechazada" });
      await fetchInvites();
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al responder invitacion" });
    } finally {
      setActionLoading(false);
    }
  };

  const sendChatMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !chatTarget.trim()) {
      setMessage({ type: "error", text: "Debes seleccionar un amigo para chatear" });
      return;
    }
    if (!chatInput.trim()) return;

    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/chat/conversation/${encodeURIComponent(chatTarget.trim())}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: chatInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo enviar el mensaje" });
        return;
      }

      setChatInput("");
      setChatMessages((prev) => [...prev, data.message]);
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al enviar mensaje" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenConversation = async (username: string) => {
    setChatTarget(username);
    await loadConversation(username);
  };

  return (
    <div style={{ border: "1px solid #ddd", padding: 20, marginBottom: 30, display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.5px", color: "#555" }}>
        Social
      </h2>

      {message && (
        <div
          style={{
            padding: 10,
            border: `1px solid ${message.type === "success" ? "#ddd" : "#ccc"}`,
            backgroundColor: message.type === "success" ? "#f0f0f0" : "#f5f5f5",
            color: message.type === "success" ? "#111" : "#555",
            fontSize: 13,
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={sendFriendRequest} style={{ display: "grid", gap: 8 }}>
        <label style={{ fontSize: 13, color: "#555" }}>Enviar solicitud de amistad por username</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={friendUsername}
            onChange={(e) => setFriendUsername(e.target.value)}
            placeholder="username"
            required
            style={{ flex: 1, padding: 10, border: "1px solid #ddd", backgroundColor: "#fafafa" }}
          />
          <button
            type="submit"
            disabled={actionLoading || friendUsername.trim().length < 3}
            style={{ padding: "10px 14px", border: "1px solid #111", backgroundColor: "#111", color: "white", cursor: "pointer" }}
          >
            Enviar
          </button>
        </div>
      </form>

      <form onSubmit={blockUser} style={{ display: "grid", gap: 8 }}>
        <label style={{ fontSize: 13, color: "#555" }}>Bloquear usuario por username</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={blockUsername}
            onChange={(e) => setBlockUsername(e.target.value)}
            placeholder="username"
            required
            style={{ flex: 1, padding: 10, border: "1px solid #ddd", backgroundColor: "#fafafa" }}
          />
          <button
            type="submit"
            disabled={actionLoading || blockUsername.trim().length < 3}
            style={{ padding: "10px 14px", border: "1px solid #ddd", backgroundColor: "white", color: "#111", cursor: "pointer" }}
          >
            Bloquear
          </button>
        </div>
      </form>

      <form onSubmit={sendMatchInvite} style={{ display: "grid", gap: 8 }}>
        <label style={{ fontSize: 13, color: "#555" }}>Invitar amigo a nueva partida</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            placeholder="username"
            required
            style={{ flex: 1, padding: 10, border: "1px solid #ddd", backgroundColor: "#fafafa" }}
          />
          <button
            type="submit"
            disabled={actionLoading || inviteUsername.trim().length < 3}
            style={{ padding: "10px 14px", border: "1px solid #111", backgroundColor: "#111", color: "white", cursor: "pointer" }}
          >
            Invitar
          </button>
        </div>
      </form>

      <section>
        <h3 style={{ margin: "8px 0", fontSize: 13, color: "#333" }}>Notificaciones en tiempo real</h3>
        {notifications.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#777" }}>Aun no tienes notificaciones.</p>
        ) : (
          <div style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto" }}>
            {notifications.map((item) => (
              <div key={item.id} style={{ border: "1px solid #eee", padding: 8, fontSize: 12, background: "#fff" }}>
                {item.text}
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "grid", gap: 12 }}>
        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "#333" }}>Solicitudes recibidas</h3>
          {loading ? (
            <p style={{ margin: 0, fontSize: 13, color: "#777" }}>Cargando...</p>
          ) : overview.incomingRequests.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#777" }}>No hay solicitudes pendientes.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {overview.incomingRequests.map((item) => (
                <div key={item.requestId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eee", padding: 10 }}>
                  <span style={{ fontSize: 13 }}>{displayUserName(item.user)}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => respondToRequest(item.requestId, "accept")}
                      disabled={actionLoading}
                      style={{ padding: "6px 10px", border: "1px solid #111", background: "#111", color: "white", cursor: "pointer", fontSize: 12 }}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => respondToRequest(item.requestId, "reject")}
                      disabled={actionLoading}
                      style={{ padding: "6px 10px", border: "1px solid #ddd", background: "white", color: "#111", cursor: "pointer", fontSize: 12 }}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "#333" }}>Invitaciones de partida recibidas</h3>
          {incomingInvites.filter((item) => item.status === "pending").length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#777" }}>No hay invitaciones pendientes.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {incomingInvites.filter((item) => item.status === "pending").map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eee", padding: 10 }}>
                  <span style={{ fontSize: 13 }}>{displayUserName(item.user)}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => respondInvite(item.id, "accept")}
                      disabled={actionLoading}
                      style={{ padding: "6px 10px", border: "1px solid #111", background: "#111", color: "white", cursor: "pointer", fontSize: 12 }}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => respondInvite(item.id, "reject")}
                      disabled={actionLoading}
                      style={{ padding: "6px 10px", border: "1px solid #ddd", background: "white", color: "#111", cursor: "pointer", fontSize: 12 }}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "#333" }}>Invitaciones enviadas</h3>
          {outgoingInvites.filter((item) => item.status === "pending").length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#777" }}>No hay invitaciones enviadas pendientes.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {outgoingInvites.filter((item) => item.status === "pending").map((item) => (
                <div key={item.id} style={{ border: "1px solid #eee", padding: 10, fontSize: 13 }}>
                  {displayUserName(item.user)}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "#333" }}>Chat en tiempo real</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            {friendUsernames.length === 0 ? (
              <span style={{ fontSize: 13, color: "#777" }}>Agrega amigos para iniciar chat.</span>
            ) : (
              friendUsernames.map((username) => (
                <button
                  key={username}
                  type="button"
                  onClick={() => void handleOpenConversation(username)}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #ddd",
                    background: chatTarget === username ? "#111" : "white",
                    color: chatTarget === username ? "white" : "#111",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {username}
                </button>
              ))
            )}
          </div>

          {chatTarget && (
            <>
              <div style={{ border: "1px solid #eee", padding: 10, minHeight: 120, maxHeight: 220, overflowY: "auto", background: "#fff" }}>
                {chatLoading ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#777" }}>Cargando conversacion...</p>
                ) : chatMessages.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#777" }}>Sin mensajes aun.</p>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {chatMessages.map((msg) => (
                      <div key={msg.id} style={{ border: "1px solid #f0f0f0", padding: 8, fontSize: 12 }}>
                        {msg.content}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <form onSubmit={sendChatMessage} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Mensaje para @${chatTarget}`}
                  style={{ flex: 1, padding: 10, border: "1px solid #ddd", backgroundColor: "#fafafa" }}
                />
                <button
                  type="submit"
                  disabled={actionLoading || !chatInput.trim()}
                  style={{ padding: "10px 14px", border: "1px solid #111", backgroundColor: "#111", color: "white", cursor: "pointer" }}
                >
                  Enviar
                </button>
              </form>
            </>
          )}
        </section>

        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "#333" }}>Solicitudes enviadas</h3>
          {overview.outgoingRequests.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#777" }}>No hay solicitudes enviadas pendientes.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {overview.outgoingRequests.map((item) => (
                <div key={item.requestId} style={{ border: "1px solid #eee", padding: 10, fontSize: 13 }}>
                  {displayUserName(item.user)}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "#333" }}>Amigos</h3>
          {overview.friends.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#777" }}>Aun no tienes amigos.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {overview.friends.map((item) => (
                <div key={item.user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eee", padding: 10 }}>
                  <span style={{ fontSize: 13 }}>{displayUserName(item.user)}</span>
                  <button
                    type="button"
                    onClick={() => blockFriend(item.user.username)}
                    disabled={actionLoading}
                    style={{ padding: "6px 10px", border: "1px solid #ddd", background: "white", color: "#111", cursor: "pointer", fontSize: 12 }}
                  >
                    Bloquear
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "#333" }}>Bloqueados</h3>
          {overview.blocks.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#777" }}>No hay usuarios bloqueados.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {overview.blocks.map((item) => (
                <div key={item.user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eee", padding: 10 }}>
                  <span style={{ fontSize: 13 }}>{displayUserName(item.user)}</span>
                  <button
                    type="button"
                    onClick={() => unblockUser(item.user.username)}
                    disabled={actionLoading}
                    style={{ padding: "6px 10px", border: "1px solid #111", background: "#111", color: "white", cursor: "pointer", fontSize: 12 }}
                  >
                    Desbloquear
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
