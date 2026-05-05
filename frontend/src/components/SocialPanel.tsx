import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import SocialChatPanel from "./SocialChatPanel";

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
  readAt?: string | null;
};

type ChatReadAt = {
  messageId: string;
  readAt?: string;
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

type ConversationSummary = {
  user: PublicUser;
  lastMessage: string;
  lastMessageAt: string;
};

type ChatProfile = PublicUser & {
  bio?: string | null;
  isFriend?: boolean;
  blockedByMe?: boolean;
  blockedMe?: boolean;
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

function resolveAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) return avatarUrl;
  return `${API}${avatarUrl}`;
}

function formatChatTimestamp(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatMessagePreview(value?: string | null): string {
  if (!value?.trim()) return "";
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 60 ? `${compact.slice(0, 57)}...` : compact;
}

export default function SocialPanel({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const { user } = useAuth();
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
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [readReceipts, setReadReceipts] = useState<Map<string, ChatReadAt>>(new Map());
  const [showChatProfile, setShowChatProfile] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [chatProfile, setChatProfile] = useState<ChatProfile | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const availableConversations = useMemo(() => {
    const merged = new Map<string, ConversationSummary>();

    for (const item of conversations) {
      merged.set(item.user.username, item);
    }

    for (const friend of overview.friends) {
      if (!merged.has(friend.user.username)) {
        merged.set(friend.user.username, {
          user: friend.user,
          lastMessage: "",
          lastMessageAt: "",
        });
      }
    }

    return Array.from(merged.values()).sort((left, right) => {
      const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
      const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
      return rightTime - leftTime || left.user.username.localeCompare(right.user.username);
    });
  }, [conversations, overview.friends]);

  const activeChatUser = useMemo(() => {
    const fromConversation = availableConversations.find((item) => item.user.username === chatTarget)?.user;
    if (fromConversation) return fromConversation;
    return overview.friends.find((friend) => friend.user.username === chatTarget)?.user ?? null;
  }, [availableConversations, chatTarget, overview.friends]);

  const chatNotifications = useMemo(
    () =>
      notifications.filter((item) => {
        const lowered = item.text.toLowerCase();
        return lowered.includes("chat") || lowered.includes("partida") || lowered.includes("tournament") || lowered.includes("torneo");
      }).slice(0, 5),
    [notifications]
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

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) return;
      setConversations(data.conversations ?? []);
    } catch (_error) {
      // Silent refresh fail
    }
  }, [token]);

  const fetchChatProfile = useCallback(async (targetUsername: string) => {
    if (!token || !targetUsername.trim()) return;
    try {
      const response = await fetch(`${API}/api/social/user/${encodeURIComponent(targetUsername.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) return;
      setChatProfile(data.user ?? null);
    } catch (_error) {
      // Silent refresh fail
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

      const readResponse = await fetch(
        `${API}/api/chat/conversation/${encodeURIComponent(targetUsername.trim())}/read`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const readData = await readResponse.json();
      if (readResponse.ok && Array.isArray(readData.updated)) {
        setReadReceipts((prev) => {
          const next = new Map(prev);
          for (const item of readData.updated) {
            if (typeof item?.messageId === "string") {
              next.set(item.messageId, {
                messageId: item.messageId,
                readAt: item.readAt,
              });
            }
          }
          return next;
        });
      }
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al cargar chat" });
    } finally {
      setChatLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOverview();
    fetchInvites();
    fetchConversations();
  }, [fetchConversations, fetchInvites, fetchOverview]);

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
          tournament_match_ready: "Tu partida de torneo esta lista",
        };

        if (messages[payload.event]) {
          setMessage({ type: "success", text: messages[payload.event] });
          pushNotification(messages[payload.event]);
        }

        if (
          payload.event === "match_invite_accepted" &&
          typeof payload.data?.roomId === "string" &&
          typeof payload.data?.opponentUsername === "string"
        ) {
          const params = new URLSearchParams({
            roomId: payload.data.roomId,
            opponent: payload.data.opponentUsername,
            source: "invite",
          });
          navigate(`/play?${params.toString()}`);
        }

        if (
          payload.event === "typing_indicator" &&
          typeof payload.data?.fromUsername === "string" &&
          payload.data.fromUsername === chatTarget
        ) {
          const fromUsername = payload.data.fromUsername;
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.add(fromUsername);
            return next;
          });
        }

        if (
          payload.event === "typing_stopped" &&
          typeof payload.data?.fromUsername === "string"
        ) {
          const fromUsername = payload.data.fromUsername;
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(fromUsername);
            return next;
          });
        }

        if (
          payload.event === "message_marked_read" &&
          typeof payload.data?.messageId === "string"
        ) {
          setReadReceipts((prev) => {
            const next = new Map(prev);
            next.set(payload.data.messageId, {
              messageId: payload.data.messageId,
              readAt: payload.data.readAt,
            });
            return next;
          });
        }

        void fetchOverview();
        void fetchInvites();
        void fetchConversations();

        if (
          payload.event === "chat_message_received" &&
          typeof payload.data?.fromUsername === "string" &&
          chatTarget.trim().length > 0 &&
          payload.data.fromUsername === chatTarget
        ) {
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
  }, [chatTarget, fetchConversations, fetchInvites, fetchOverview, loadConversation, navigate, pushNotification, token]);

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

  const blockFromChat = async () => {
    if (!token || !chatTarget.trim()) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/chat/conversation/${encodeURIComponent(chatTarget.trim())}/block`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo bloquear al usuario" });
        return;
      }
      setMessage({ type: "success", text: data.message });
      setChatTarget("");
      setChatMessages([]);
      setChatProfile(null);
      await fetchOverview();
      await fetchConversations();
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al bloquear" });
    } finally {
      setActionLoading(false);
    }
  };

  const inviteFromChat = async () => {
    if (!token || !chatTarget.trim()) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/chat/conversation/${encodeURIComponent(chatTarget.trim())}/invite-to-game`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "No se pudo enviar la invitacion" });
        return;
      }
      setMessage({ type: "success", text: data.message });
      await fetchInvites();
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al invitar" });
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
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      await fetch(`${API}/api/chat/conversation/${encodeURIComponent(chatTarget.trim())}/typing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ typing: false }),
      });
      setChatMessages((prev) => [...prev, data.message]);
      await fetchConversations();
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al enviar mensaje" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenConversation = async (username: string) => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) return;

    if (chatTarget === normalizedUsername) {
      if (token) {
        try {
          await fetch(`${API}/api/chat/conversation/${encodeURIComponent(normalizedUsername)}/typing`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ typing: false }),
          });
        } catch (_error) {
          // Silent close cleanup.
        }
      }

      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      setChatTarget("");
      setShowChatProfile(false);
      setChatInput("");
      setChatMessages([]);
      setChatProfile(null);
      return;
    }

    setChatTarget(normalizedUsername);
    setShowChatProfile(false);
    await Promise.all([loadConversation(normalizedUsername), fetchChatProfile(normalizedUsername)]);
  };

  const handleChatInputChange = async (value: string) => {
    setChatInput(value);
    if (!token || !chatTarget.trim()) return;

    await fetch(`${API}/api/chat/conversation/${encodeURIComponent(chatTarget.trim())}/typing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ typing: value.trim().length > 0 }),
    });

    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      void fetch(`${API}/api/chat/conversation/${encodeURIComponent(chatTarget.trim())}/typing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ typing: false }),
      });
    }, 1200);
  };

  return (
    <div className="social-panel-shell" style={{ border: "1px solid rgba(255, 255, 255, 0.16)", padding: 20, marginBottom: 30, display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--ink-muted)" }}>
        {t("SOCIAL")}
      </h2>

      {message && (
        <div
          style={{
            padding: 10,
            border: `1px solid ${message.type === "success" ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.2)"}`,
            backgroundColor: message.type === "success" ? "rgba(0, 240, 255, 0.1)" : "rgba(255, 255, 255, 0.08)",
            color: message.type === "success" ? "#9ef8ff" : "var(--ink-muted)",
            fontSize: 13,
          }}
        >
          {message.text}
        </div>
      )}

      <div className="social-panel-stack">
        <div className="social-panel-tools">
          <form onSubmit={sendFriendRequest} style={{ display: "grid", gap: 8 }}>
        <label style={{ fontSize: 13, color: "var(--ink-muted)" }}>{t("FRIEND_REQUEST_BY_USERNAME")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={friendUsername}
            onChange={(e) => setFriendUsername(e.target.value)}
            placeholder="username"
            required
            style={{ flex: 1, padding: 10, border: "1px solid rgba(255, 255, 255, 0.16)", backgroundColor: "rgba(8, 10, 20, 0.86)" }}
          />
          <button
            type="submit"
            disabled={actionLoading || friendUsername.trim().length < 3}
            style={{ padding: "10px 14px", border: "1px solid rgba(0, 240, 255, 0.55)", backgroundColor: "rgba(0, 240, 255, 0.18)", color: "#9ef8ff", cursor: "pointer" }}
          >
            {t("SEND")}
          </button>
        </div>
      </form>

      <form onSubmit={blockUser} style={{ display: "grid", gap: 8 }}>
        <label style={{ fontSize: 13, color: "var(--ink-muted)" }}>{t("BLOCK_USER_BY_USERNAME")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={blockUsername}
            onChange={(e) => setBlockUsername(e.target.value)}
            placeholder="username"
            required
            style={{ flex: 1, padding: 10, border: "1px solid rgba(255, 255, 255, 0.16)", backgroundColor: "rgba(8, 10, 20, 0.86)" }}
          />
          <button
            type="submit"
            disabled={actionLoading || blockUsername.trim().length < 3}
            style={{ padding: "10px 14px", border: "1px solid rgba(255, 255, 255, 0.16)", backgroundColor: "rgba(8, 10, 20, 0.86)", color: "var(--ink-strong)", cursor: "pointer" }}
          >
            {t("BLOCK")}
          </button>
        </div>
      </form>

      <form onSubmit={sendMatchInvite} style={{ display: "grid", gap: 8 }}>
        <label style={{ fontSize: 13, color: "var(--ink-muted)" }}>{t("INVITE_FRIEND_TO_MATCH")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            placeholder="username"
            required
            style={{ flex: 1, padding: 10, border: "1px solid rgba(255, 255, 255, 0.16)", backgroundColor: "rgba(8, 10, 20, 0.86)" }}
          />
          <button
            type="submit"
            disabled={actionLoading || inviteUsername.trim().length < 3}
            style={{ padding: "10px 14px", border: "1px solid rgba(0, 240, 255, 0.55)", backgroundColor: "rgba(0, 240, 255, 0.18)", color: "#9ef8ff", cursor: "pointer" }}
          >
            {t("INVITE")}
          </button>
        </div>
      </form>

      <section>
        <h3 style={{ margin: "8px 0", fontSize: 13, color: "var(--ink-strong)" }}>{t("REALTIME_NOTIFICATIONS")}</h3>
        {notifications.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{t("NO_REALTIME_NOTIFICATIONS")}</p>
        ) : (
          <div style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto" }}>
            {notifications.map((item) => (
              <div key={item.id} style={{ border: "1px solid rgba(255, 255, 255, 0.12)", padding: 8, fontSize: 12, background: "rgba(8, 10, 20, 0.86)" }}>
                {item.text}
              </div>
            ))}
          </div>
        )}
        </section>
      </div>

      <div className="social-panel-overview">
        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "var(--ink-strong)" }}>{t("INCOMING_REQUESTS")}</h3>
          {loading ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{t("LOADING")}</p>
          ) : overview.incomingRequests.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{t("NO_PENDING_REQUESTS")}</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {overview.incomingRequests.map((item) => (
                <div key={item.requestId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255, 255, 255, 0.12)", padding: 10 }}>
                  <span style={{ fontSize: 13 }}>{displayUserName(item.user)}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => respondToRequest(item.requestId, "accept")}
                      disabled={actionLoading}
                      style={{ padding: "6px 10px", border: "1px solid rgba(0, 240, 255, 0.55)", background: "rgba(0, 240, 255, 0.18)", color: "#9ef8ff", cursor: "pointer", fontSize: 12 }}
                    >
                      {t("ACCEPT")}
                    </button>
                    <button
                      type="button"
                      onClick={() => respondToRequest(item.requestId, "reject")}
                      disabled={actionLoading}
                      style={{ padding: "6px 10px", border: "1px solid rgba(255, 255, 255, 0.16)", background: "rgba(8, 10, 20, 0.86)", color: "var(--ink-strong)", cursor: "pointer", fontSize: 12 }}
                    >
                      {t("REJECT")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "var(--ink-strong)" }}>{t("MATCH_INVITES_RECEIVED")}</h3>
          {incomingInvites.filter((item) => item.status === "pending").length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{t("NO_PENDING_INVITES")}</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {incomingInvites.filter((item) => item.status === "pending").map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255, 255, 255, 0.12)", padding: 10 }}>
                  <span style={{ fontSize: 13 }}>{displayUserName(item.user)}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => respondInvite(item.id, "accept")}
                      disabled={actionLoading}
                      style={{ padding: "6px 10px", border: "1px solid rgba(0, 240, 255, 0.55)", background: "rgba(0, 240, 255, 0.18)", color: "#9ef8ff", cursor: "pointer", fontSize: 12 }}
                    >
                      {t("ACCEPT")}
                    </button>
                    <button
                      type="button"
                      onClick={() => respondInvite(item.id, "reject")}
                      disabled={actionLoading}
                      style={{ padding: "6px 10px", border: "1px solid rgba(255, 255, 255, 0.16)", background: "rgba(8, 10, 20, 0.86)", color: "var(--ink-strong)", cursor: "pointer", fontSize: 12 }}
                    >
                      {t("REJECT")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "var(--ink-strong)" }}>{t("MATCH_INVITES_SENT")}</h3>
          {outgoingInvites.filter((item) => item.status === "pending").length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{t("NO_SENT_INVITES")}</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {outgoingInvites.filter((item) => item.status === "pending").map((item) => (
                <div key={item.id} style={{ border: "1px solid rgba(255, 255, 255, 0.12)", padding: 10, fontSize: 13 }}>
                  {displayUserName(item.user)}
                </div>
              ))}
            </div>
          )}
        </section>

        <SocialChatPanel
          actionLoading={actionLoading}
          availableConversations={availableConversations}
          activeChatUser={activeChatUser}
          chatInput={chatInput}
          chatLoading={chatLoading}
          chatMessages={chatMessages}
          chatNotifications={chatNotifications}
          chatProfile={chatProfile}
          chatTarget={chatTarget}
          currentUserId={user?.id}
          readReceipts={readReceipts}
          showChatProfile={showChatProfile}
          typingUsers={typingUsers}
          onBlockFromChat={() => void blockFromChat()}
          onChatInputChange={(value) => void handleChatInputChange(value)}
          onInviteFromChat={() => void inviteFromChat()}
          onOpenConversation={(username) => void handleOpenConversation(username)}
          onSendChatMessage={sendChatMessage}
          onToggleProfile={() => setShowChatProfile((prev) => !prev)}
        />

        {false && (
        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "var(--ink-strong)" }}>{t("REALTIME_CHAT")}</h3>
          <div className="social-chat-layout">
            <div className="social-chat-conversation-list">
              {availableConversations.length === 0 ? (
                <div className="social-chat-empty-state">{t("ADD_FRIENDS_TO_CHAT")}</div>
              ) : (
                availableConversations.map((conversation) => {
                  const isActive = chatTarget === conversation.user.username;
                  const avatarUrl = resolveAvatarUrl(conversation.user.avatarUrl);
                  return (
                    <button
                      key={conversation.user.username}
                      type="button"
                      onClick={() => void handleOpenConversation(conversation.user.username)}
                      className={`social-chat-conversation-card${isActive ? " is-active" : ""}`}
                    >
                      <div className="social-chat-conversation-main">
                        <div className="social-chat-avatar">
                          {avatarUrl ? <img src={avatarUrl} alt={conversation.user.username} /> : <span>{conversation.user.username.slice(0, 1).toUpperCase()}</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-strong)" }}>
                            {displayUserName(conversation.user)}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {formatMessagePreview(conversation.lastMessage) || t("NO_MESSAGES")}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                        {formatChatTimestamp(conversation.lastMessageAt)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="social-chat-panel">
              {!chatTarget ? (
                <div className="social-chat-empty-state">{t("OPEN_CONVERSATION")}</div>
              ) : (
                <>
                  <div className="social-chat-header">
                    <div style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-strong)" }}>
                        {displayUserName(chatProfile ?? activeChatUser ?? { id: 0, username: chatTarget })}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>@{chatTarget}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => setShowChatProfile((prev) => !prev)}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid rgba(255, 255, 255, 0.16)",
                        background: "rgba(8, 10, 20, 0.86)",
                        color: "var(--ink-strong)",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      👤 {t("PROFILE")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void inviteFromChat()}
                      disabled={actionLoading}
                      style={{
                        padding: "4px 8px",
                        border: "1px solid rgba(0, 240, 255, 0.55)",
                        background: "rgba(0, 240, 255, 0.18)",
                        color: "#9ef8ff",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      🎮 {t("INVITE")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void blockFromChat()}
                      disabled={actionLoading}
                      style={{
                        padding: "4px 8px",
                        border: "1px solid rgba(255, 255, 255, 0.16)",
                        background: "rgba(8, 10, 20, 0.86)",
                        color: "var(--ink-muted)",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      🚫 {t("BLOCK")}
                    </button>
                  </div>
                </div>
                  {showChatProfile && (
                    <div className="social-chat-profile-card">
                      <div className="social-chat-profile-head">
                        <div className="social-chat-avatar large">
                          {resolveAvatarUrl((chatProfile ?? activeChatUser)?.avatarUrl) ? (
                            <img src={resolveAvatarUrl((chatProfile ?? activeChatUser)?.avatarUrl) ?? ""} alt={chatTarget} />
                          ) : (
                            <span>{chatTarget.slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <strong style={{ color: "var(--ink-strong)" }}>
                            {displayUserName(chatProfile ?? activeChatUser ?? { id: 0, username: chatTarget })}
                          </strong>
                          <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                            {(chatProfile?.bio?.trim() || activeChatUser?.displayName?.trim()) ?? t("NO_BIO_YET")}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {chatProfile?.isFriend ? <span className="social-chat-badge">{t("FRIENDS")}</span> : null}
                        {chatProfile?.blockedByMe ? <span className="social-chat-badge muted">{t("BLOCK")}</span> : null}
                        {chatProfile?.blockedMe ? <span className="social-chat-badge muted">{t("BLOCKED")}</span> : null}
                      </div>
                    </div>
                  )}
                  {chatNotifications.length > 0 && (
                    <div className="social-chat-notification-strip">
                      {chatNotifications.map((item) => (
                        <div key={item.id} className="social-chat-notification-pill">
                          {item.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <div ref={chatScrollRef} className="social-chat-messages">
                    {chatLoading ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{t("LOADING_CONVERSATION")}</p>
                    ) : chatMessages.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{t("NO_MESSAGES")}</p>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                    {chatMessages.map((msg) => {
                      const readInfo = readReceipts.get(msg.id);
                      const sentByMe = msg.fromUserId === user?.id;
                      const senderLabel = sentByMe ? t("YOU") : `@${chatTarget}`;
                      return (
                        <div key={msg.id} style={{ border: "1px solid rgba(0, 240, 255, 0.1)", padding: 8, fontSize: 12 }}>
                          <div style={{ marginBottom: 4, color: sentByMe ? "#9ef8ff" : "var(--ink-muted)", fontSize: 11, fontWeight: 700 }}>
                            {senderLabel}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <span>{msg.content}</span>
                            <span style={{ color: readInfo ? "#9ef8ff" : "var(--ink-muted)", fontSize: 10 }}>✓</span>
                          </div>
                          {readInfo?.readAt ? (
                            <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--ink-muted)" }}>
                              {t("READ")}: {new Date(readInfo.readAt).toLocaleTimeString()}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
                {typingUsers.has(chatTarget) && (
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9ef8ff", fontStyle: "italic" }}>
                    @{chatTarget} {t("IS_TYPING")}
                  </p>
                )}
              </div>
              <form onSubmit={sendChatMessage} className="social-chat-compose">
                <input
                  value={chatInput}
                  onChange={(e) => void handleChatInputChange(e.target.value)}
                  placeholder={t("MESSAGE_FOR", { username: chatTarget })}
                  disabled={Boolean(chatProfile?.blockedByMe || chatProfile?.blockedMe)}
                  style={{ flex: 1, padding: 10, border: "1px solid rgba(255, 255, 255, 0.16)", backgroundColor: "rgba(8, 10, 20, 0.86)" }}
                />
                <button
                  type="submit"
                  disabled={actionLoading || !chatInput.trim() || Boolean(chatProfile?.blockedByMe || chatProfile?.blockedMe)}
                  style={{ padding: "10px 14px", border: "1px solid rgba(0, 240, 255, 0.55)", backgroundColor: "rgba(0, 240, 255, 0.18)", color: "#9ef8ff", cursor: "pointer" }}
                >
                  {t("SEND")}
                </button>
              </form>
            </>
          )}
            </div>
          </div>
        </section>
        )}
        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "var(--ink-strong)" }}>{t("OUTGOING_REQUESTS")}</h3>
          {overview.outgoingRequests.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{t("NO_PENDING_REQUESTS")}</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {overview.outgoingRequests.map((item) => (
                <div key={item.requestId} style={{ border: "1px solid rgba(255, 255, 255, 0.12)", padding: 10, fontSize: 13 }}>
                  {displayUserName(item.user)}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "var(--ink-strong)" }}>{t("FRIENDS")}</h3>
          {overview.friends.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{t("NO_FRIENDS")}</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {overview.friends.map((item) => (
                <div key={item.user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255, 255, 255, 0.12)", padding: 10 }}>
                  <span style={{ fontSize: 13 }}>{displayUserName(item.user)}</span>
                  <button
                    type="button"
                    onClick={() => blockFriend(item.user.username)}
                    disabled={actionLoading}
                    style={{ padding: "6px 10px", border: "1px solid rgba(255, 255, 255, 0.16)", background: "rgba(8, 10, 20, 0.86)", color: "var(--ink-strong)", cursor: "pointer", fontSize: 12 }}
                  >
                    {t("BLOCK")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ margin: "8px 0", fontSize: 13, color: "var(--ink-strong)" }}>{t("BLOCKED")}</h3>
          {overview.blocks.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{t("NO_BLOCKED_USERS")}</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {overview.blocks.map((item) => (
                <div key={item.user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255, 255, 255, 0.12)", padding: 10 }}>
                  <span style={{ fontSize: 13 }}>{displayUserName(item.user)}</span>
                  <button
                    type="button"
                    onClick={() => unblockUser(item.user.username)}
                    disabled={actionLoading}
                    style={{ padding: "6px 10px", border: "1px solid rgba(0, 240, 255, 0.55)", background: "rgba(0, 240, 255, 0.18)", color: "#9ef8ff", cursor: "pointer", fontSize: 12 }}
                  >
                    {t("UNBLOCK")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
