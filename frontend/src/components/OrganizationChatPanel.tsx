import React from "react";

type OrganizationChatMessage = {
  id: number;
  author: {
    id: number;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  content: string;
  createdAt: string;
};

type OrganizationChatPanelProps = {
  messages: OrganizationChatMessage[];
  draft: string;
  loading: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  formatDate: (value?: string | null) => string;
};

export default function OrganizationChatPanel({
  messages,
  draft,
  loading,
  onDraftChange,
  onSubmit,
  formatDate,
}: OrganizationChatPanelProps) {
  return (
    <div className="profile-panel organization-chat-panel">
      <div className="organization-head">
        <div>
          <h2>Chat</h2>
          <p>Habla con los miembros de la organizacion.</p>
        </div>
        <span>{messages.length} mensajes</span>
      </div>

      <div className="organization-chat-list-shell">
        <div className="organization-chat-list">
          {messages.length === 0 ? (
            <p className="muted">Todavia no hay mensajes en esta organizacion.</p>
          ) : (
            messages.map((chatMessage) => (
              <article key={chatMessage.id} className="organization-chat-message">
                <div className="organization-chat-message-head">
                  <strong>@{chatMessage.author.username}</strong>
                  <span>{formatDate(chatMessage.createdAt)}</span>
                </div>
                <p>{chatMessage.content}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <form className="organization-chat-form" onSubmit={onSubmit}>
        <textarea
          className="organization-chat-input"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Escribe un mensaje para la organizacion"
        />
        <button className="btn-premium" type="submit" disabled={loading || !draft.trim()}>
          {loading ? "Enviando..." : "Enviar mensaje"}
        </button>
      </form>
    </div>
  );
}
