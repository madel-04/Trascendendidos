import { useEffect, useRef, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type PublicUser = {
  id: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
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

type InAppNotification = {
  id: string;
  text: string;
  createdAt: number;
};

type Props = {
  actionLoading: boolean;
  availableConversations: ConversationSummary[];
  activeChatUser: PublicUser | null;
  chatInput: string;
  chatLoading: boolean;
  chatMessages: ChatMessage[];
  chatNotifications: InAppNotification[];
  chatProfile: ChatProfile | null;
  chatTarget: string;
  currentUserId?: number;
  readReceipts: Map<string, ChatReadAt>;
  showChatProfile: boolean;
  typingUsers: Set<string>;
  onChatInputChange: (value: string) => void;
  onInviteFromChat: () => void;
  onOpenConversation: (username: string) => void;
  onSendChatMessage: (event: FormEvent) => void;
  onToggleProfile: () => void;
  onBlockFromChat: () => void;
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

export default function SocialChatPanel({
  actionLoading,
  availableConversations,
  activeChatUser,
  chatInput,
  chatLoading,
  chatMessages,
  chatNotifications,
  chatProfile,
  chatTarget,
  currentUserId,
  readReceipts,
  showChatProfile,
  typingUsers,
  onBlockFromChat,
  onChatInputChange,
  onInviteFromChat,
  onOpenConversation,
  onSendChatMessage,
  onToggleProfile,
}: Props) {
  const { t } = useTranslation();
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, typingUsers, chatTarget]);

  return (
    <section className="social-chat-section">
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
                  onClick={() => onOpenConversation(conversation.user.username)}
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
                <div className="social-chat-actions">
                  <button type="button" className="social-chat-action-btn" onClick={onToggleProfile}>
                    {t("PROFILE")}
                  </button>
                  <button
                    type="button"
                    className="social-chat-action-btn accent"
                    onClick={onInviteFromChat}
                    disabled={actionLoading || Boolean(chatProfile?.blockedByMe || chatProfile?.blockedMe)}
                  >
                    {t("INVITE")}
                  </button>
                  <button type="button" className="social-chat-action-btn" onClick={onBlockFromChat} disabled={actionLoading}>
                    {t("BLOCK")}
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
                      const sentByMe = msg.fromUserId === currentUserId;
                      const senderLabel = sentByMe ? t("YOU") : `@${chatTarget}`;
                      return (
                        <div key={msg.id} className={`social-chat-message${sentByMe ? " is-own" : ""}`}>
                          <div className="social-chat-message-head">
                            <span style={{ color: sentByMe ? "#9ef8ff" : "var(--ink-muted)", fontSize: 11, fontWeight: 700 }}>
                              {senderLabel}
                            </span>
                            <span style={{ color: "var(--ink-muted)", fontSize: 10 }}>
                              {formatChatTimestamp(msg.createdAt)}
                            </span>
                          </div>
                          <div className="social-chat-message-body">{msg.content}</div>
                          {sentByMe ? (
                            <div className="social-chat-message-status">
                              <span style={{ fontSize: 10, color: "var(--ink-muted)" }}>
                                {readInfo?.readAt ? `${t("READ")}: ${new Date(readInfo.readAt).toLocaleTimeString()}` : ""}
                              </span>
                              <span style={{ color: readInfo?.readAt ? "#9ef8ff" : "var(--ink-muted)", fontSize: 11 }}>
                                {readInfo?.readAt ? "✓✓" : "✓"}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {typingUsers.has(chatTarget) && (
                <p style={{ margin: 0, fontSize: 11, color: "#9ef8ff", fontStyle: "italic" }}>
                  @{chatTarget} {t("IS_TYPING")}
                </p>
              )}

              <form onSubmit={onSendChatMessage} className="social-chat-compose">
                <input
                  value={chatInput}
                  onChange={(e) => onChatInputChange(e.target.value)}
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
  );
}
