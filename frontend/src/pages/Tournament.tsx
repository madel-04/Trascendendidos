import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type TournamentPermissions = {
  canManage: boolean;
  canEdit: boolean;
  canCancel: boolean;
  canStart: boolean;
};

type TournamentCreator = {
  id: number;
  username: string;
  role: "host";
};

type TournamentListItem = {
  id: number;
  name: string;
  description: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  maxPlayers: number;
  participantsCount: number;
  creator: TournamentCreator;
  permissions: TournamentPermissions;
  championUsername: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
};

type TournamentDetail = {
  tournament: {
    id: number;
    name: string;
    description: string;
    status: "open" | "in_progress" | "completed" | "cancelled";
    maxPlayers: number;
    creator: TournamentCreator;
    permissions: TournamentPermissions;
    championUsername: string | null;
    createdAt: string;
    startedAt: string | null;
    endedAt: string | null;
  };
  participants: Array<{
    id: number;
    userId: number;
    username: string;
    seed: number | null;
    joinedAt: string;
  }>;
  matches: Array<{
    id: number;
    round: number;
    order: number;
    status: "pending" | "completed";
    gameRoomId: string | null;
    player1: { id: number; username: string };
    player2: { id: number; username: string } | null;
    winner: { id: number; username: string } | null;
    completedAt: string | null;
  }>;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function Tournament() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxPlayers, setMaxPlayers] = useState<4 | 8 | 16>(4);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const authHeaders = useMemo(() => {
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const requestedTournamentId = useMemo(() => {
    const raw = searchParams.get("tournamentId");
    if (!raw) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }, [searchParams]);

  const loadList = useCallback(async () => {
    if (!token || !authHeaders) return;
    setLoadingList(true);
    try {
      const response = await fetch(`${API}/api/tournament`, { headers: authHeaders });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? t("TOURNAMENT_LIST_LOAD_ERROR") });
        return;
      }
      setTournaments(data.tournaments ?? []);

      setSelectedTournamentId((current) => {
        if (requestedTournamentId && (data.tournaments ?? []).some((item: TournamentListItem) => item.id === requestedTournamentId)) {
          return requestedTournamentId;
        }
        if (current && (data.tournaments ?? []).some((item: TournamentListItem) => item.id === current)) {
          return current;
        }
        return data.tournaments?.[0]?.id ?? null;
      });
    } catch (_error) {
      setMessage({ type: "error", text: t("TOURNAMENT_LIST_CONNECTION_ERROR") });
    } finally {
      setLoadingList(false);
    }
  }, [authHeaders, requestedTournamentId, t, token]);

  const loadDetail = useCallback(async (tournamentId: number) => {
    if (!token || !authHeaders) return;
    setLoadingDetail(true);
    try {
      const response = await fetch(`${API}/api/tournament/${tournamentId}`, { headers: authHeaders });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? t("TOURNAMENT_DETAIL_LOAD_ERROR") });
        return;
      }
      setDetail(data as TournamentDetail);
    } catch (_error) {
      setMessage({ type: "error", text: t("TOURNAMENT_DETAIL_CONNECTION_ERROR") });
    } finally {
      setLoadingDetail(false);
    }
  }, [authHeaders, t, token]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedTournamentId) {
      setDetail(null);
      setEditing(false);
      return;
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tournamentId", String(selectedTournamentId));
      return next;
    }, { replace: true });

    void loadDetail(selectedTournamentId);
  }, [loadDetail, selectedTournamentId, setSearchParams]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !authHeaders) return;

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (trimmedName.length < 3) {
      setMessage({ type: "error", text: t("TOURNAMENT_NAME_MIN") });
      return;
    }

    setCreating(true);
    setMessage(null);

    try {
      const response = await fetch(`${API}/api/tournament`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName, description: trimmedDescription, maxPlayers }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? t("TOURNAMENT_CREATE_ERROR") });
        return;
      }

      setName("");
      setDescription("");
      setMessage({ type: "success", text: t("TOURNAMENT_CREATED_SUCCESS") });
      await loadList();
      if (data?.tournament?.id) {
        setSelectedTournamentId(Number(data.tournament.id));
      }
    } catch (_error) {
      setMessage({ type: "error", text: t("TOURNAMENT_CREATE_CONNECTION_ERROR") });
    } finally {
      setCreating(false);
    }
  };

  const performAction = async (path: string, payload?: unknown) => {
    if (!token || !authHeaders || !selectedTournamentId) return;
    setActionBusy(true);
    setMessage(null);

    try {
      const hasPayload = payload !== undefined;
      const response = await fetch(`${API}${path}`, {
        method: "POST",
        headers: hasPayload
          ? {
              ...authHeaders,
              "Content-Type": "application/json",
            }
          : authHeaders,
        body: hasPayload ? JSON.stringify(payload) : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? t("TOURNAMENT_ACTION_ERROR") });
        return;
      }

      setEditing(false);
      setMessage({ type: "success", text: data.message ?? t("TOURNAMENT_ACTION_SUCCESS") });
      await loadList();
      await loadDetail(selectedTournamentId);
    } catch (_error) {
      setMessage({ type: "error", text: t("TOURNAMENT_ACTION_CONNECTION_ERROR") });
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveTournament = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !token || !authHeaders) return;

    const trimmedName = editName.trim();
    const trimmedDescription = editDescription.trim();
    if (trimmedName.length < 3) {
      setMessage({ type: "error", text: t("TOURNAMENT_NAME_MIN") });
      return;
    }

    setActionBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`${API}/api/tournament/${detail.tournament.id}`, {
        method: "PUT",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName, description: trimmedDescription }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? t("TOURNAMENT_UPDATE_ERROR") });
        return;
      }

      setEditing(false);
      setMessage({ type: "success", text: data.message ?? t("TOURNAMENT_UPDATED_SUCCESS") });
      await loadList();
      await loadDetail(detail.tournament.id);
    } catch (_error) {
      setMessage({ type: "error", text: t("TOURNAMENT_UPDATE_CONNECTION_ERROR") });
    } finally {
      setActionBusy(false);
    }
  };

  const beginEditing = () => {
    if (!detail) return;
    setEditName(detail.tournament.name);
    setEditDescription(detail.tournament.description ?? "");
    setEditing(true);
    setMessage(null);
  };

  const isParticipant = Boolean(detail?.participants.some((participant) => participant.userId === user?.id));
  const canJoin = detail?.tournament.status === "open" && !isParticipant && (detail?.participants.length ?? 0) < (detail?.tournament.maxPlayers ?? 0);
  const canStart = Boolean(detail?.tournament.permissions.canStart && (detail?.participants.length ?? 0) >= 2);
  const canEditTournament = Boolean(detail?.tournament.permissions.canEdit);
  const canCancelTournament = Boolean(detail?.tournament.permissions.canCancel);
  const showTournamentActions = detail?.tournament.status === "open" || detail?.tournament.status === "in_progress";

  const getTournamentStatusLabel = useCallback((status: TournamentListItem["status"]) => {
    if (status === "open") return t("TOURNAMENT_STATUS_OPEN");
    if (status === "in_progress") return t("TOURNAMENT_STATUS_IN_PROGRESS");
    if (status === "completed") return t("TOURNAMENT_STATUS_COMPLETED");
    return t("TOURNAMENT_STATUS_CANCELLED");
  }, [t]);

  const getMatchStatusLabel = useCallback((status: TournamentDetail["matches"][number]["status"]) => {
    return status === "completed" ? t("TOURNAMENT_MATCH_STATUS_COMPLETED") : t("TOURNAMENT_MATCH_STATUS_PENDING");
  }, [t]);

  const groupedMatches = useMemo(() => {
    const rounds = new Map<number, TournamentDetail["matches"]>();
    for (const match of detail?.matches ?? []) {
      const current = rounds.get(match.round) ?? [];
      current.push(match);
      rounds.set(match.round, current);
    }
    return Array.from(rounds.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, matches]) => ({ round, matches }));
  }, [detail?.matches]);

  return (
    <section className="glass-panel play-hub-panel play-hub-panel-enter page-hub-panel tournament-shell">
      <div className="page-hub-layout tournament-grid">
        <article className="tournament-column">
          <h2 className="page-title">{t("TOURNAMENT_PAGE_TITLE")}</h2>
          <p className="page-subtitle">{t("TOURNAMENT_PAGE_SUBTITLE")}</p>

          <form className="tournament-create" onSubmit={handleCreate}>
            <label className="auth-label" htmlFor="tournamentName">{t("TOURNAMENT_NAME_LABEL")}</label>
            <input
              id="tournamentName"
              className="auth-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("TOURNAMENT_NAME_PLACEHOLDER")}
              maxLength={120}
            />

            <label className="auth-label" htmlFor="tournamentDescription">{t("TOURNAMENT_DESCRIPTION_LABEL")}</label>
            <textarea
              id="tournamentDescription"
              className="auth-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("TOURNAMENT_DESCRIPTION_PLACEHOLDER")}
              maxLength={500}
              rows={4}
            />

            <label className="auth-label" htmlFor="tournamentSize">{t("TOURNAMENT_SIZE_LABEL")}</label>
            <select
              id="tournamentSize"
              className="auth-input"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value) as 4 | 8 | 16)}
            >
              <option value={4}>{t("TOURNAMENT_SIZE_OPTION", { count: 4 })}</option>
              <option value={8}>{t("TOURNAMENT_SIZE_OPTION", { count: 8 })}</option>
              <option value={16}>{t("TOURNAMENT_SIZE_OPTION", { count: 16 })}</option>
            </select>

            <button className="btn-premium" type="submit" disabled={creating || !token}>
              {creating ? t("TOURNAMENT_CREATING") : t("TOURNAMENT_CREATE_ACTION")}
            </button>
          </form>

          <div className="tournament-list-wrap">
            {loadingList ? <p className="muted">{t("TOURNAMENT_LOADING_LIST")}</p> : null}
            {!loadingList && tournaments.length === 0 ? <p className="muted">{t("TOURNAMENT_EMPTY_LIST")}</p> : null}
            {tournaments.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`tournament-list-item ${selectedTournamentId === item.id ? "active" : ""}`}
                onClick={() => setSelectedTournamentId(item.id)}
              >
                <div>
                  <strong>{item.name}</strong>
                  <span className="muted">{item.creator.username} · {t("TOURNAMENT_HOST_ROLE")}</span>
                </div>
                <div>
                  <span className="status-pill">{getTournamentStatusLabel(item.status)}</span>
                  <span className="muted">{item.participantsCount}/{item.maxPlayers}</span>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="tournament-column">
          {!selectedTournamentId ? <p className="muted">{t("TOURNAMENT_SELECT_DETAIL")}</p> : null}
          {selectedTournamentId && loadingDetail ? <p className="muted">{t("TOURNAMENT_LOADING_DETAIL")}</p> : null}

          {detail ? (
            <div key={selectedTournamentId} className="tournament-detail profile-tab-stage profile-tab-stage-enter">
              <div className="tournament-head">
                <div>
                  <h2 className="page-title">{detail.tournament.name}</h2>
                  <p className="page-subtitle">
                    {t("TOURNAMENT_HOST")}: {detail.tournament.creator.username} · {t("TOURNAMENT_STATE")}: {getTournamentStatusLabel(detail.tournament.status)}
                  </p>
                  <p className="muted">{detail.tournament.description || t("TOURNAMENT_NO_DESCRIPTION")}</p>
                </div>
                {showTournamentActions ? (
                  <div className="tournament-actions">
                    {canJoin ? (
                      <button
                        type="button"
                        className="btn-premium secondary"
                        disabled={actionBusy}
                        onClick={() => performAction(`/api/tournament/${detail.tournament.id}/join`)}
                      >
                        {t("TOURNAMENT_JOIN")}
                      </button>
                    ) : null}
                    {canStart ? (
                      <button
                        type="button"
                        className="btn-premium"
                        disabled={actionBusy}
                        onClick={() => performAction(`/api/tournament/${detail.tournament.id}/start`)}
                      >
                        {t("TOURNAMENT_START")}
                      </button>
                    ) : null}
                    {canEditTournament ? (
                      <button
                        type="button"
                        className="btn-premium tertiary"
                        disabled={actionBusy}
                        onClick={beginEditing}
                      >
                        {t("TOURNAMENT_EDIT")}
                      </button>
                    ) : null}
                    {canCancelTournament ? (
                      <button
                        type="button"
                        className="btn-premium tertiary"
                        disabled={actionBusy}
                        onClick={() => performAction(`/api/tournament/${detail.tournament.id}/cancel`)}
                      >
                        {t("TOURNAMENT_CANCEL")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {editing ? (
                <form className="tournament-create" onSubmit={handleSaveTournament}>
                  <label className="auth-label" htmlFor="editTournamentName">{t("TOURNAMENT_NAME_LABEL")}</label>
                  <input
                    id="editTournamentName"
                    className="auth-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={120}
                  />

                  <label className="auth-label" htmlFor="editTournamentDescription">{t("TOURNAMENT_DESCRIPTION_LABEL")}</label>
                  <textarea
                    id="editTournamentDescription"
                    className="auth-input"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    maxLength={500}
                    rows={4}
                  />

                  <div className="tournament-actions">
                    <button className="btn-premium" type="submit" disabled={actionBusy}>
                      {t("TOURNAMENT_SAVE_CHANGES")}
                    </button>
                    <button
                      className="btn-premium secondary"
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setEditing(false)}
                    >
                      {t("TOURNAMENT_CLOSE")}
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="tournament-meta-grid">
                <div className="feature-card">
                  <h3>{t("TOURNAMENT_PLAYERS")}</h3>
                  <p>{detail.participants.length} / {detail.tournament.maxPlayers}</p>
                </div>
                <div className="feature-card">
                  <h3>{t("TOURNAMENT_CREATED_AT")}</h3>
                  <p>{formatDate(detail.tournament.createdAt)}</p>
                </div>
                <div className="feature-card">
                  <h3>{t("TOURNAMENT_CHAMPION")}</h3>
                  <p>{detail.tournament.championUsername ?? t("TOURNAMENT_CHAMPION_PENDING")}</p>
                </div>
              </div>

              <section>
                <h3>{t("TOURNAMENT_PARTICIPANTS")}</h3>
                <div className="tournament-chip-list">
                  {detail.participants.map((participant) => (
                    <span key={participant.id} className="tournament-chip">
                      {participant.username}
                      {participant.seed ? ` #${participant.seed}` : ""}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <h3>{t("TOURNAMENT_BRACKET")}</h3>
                {detail.matches.length === 0 ? <p className="muted">{t("TOURNAMENT_NO_MATCHES")}</p> : null}
                <div className="tournament-bracket">
                  {groupedMatches.map((roundGroup) => (
                    <div key={roundGroup.round} className="tournament-round">
                      <div className="tournament-round-title">{t("TOURNAMENT_ROUND", { round: roundGroup.round })}</div>
                      <div className="tournament-round-stack">
                        {roundGroup.matches.map((match) => {
                          const isCurrentPlayerMatch = user?.id === match.player1.id || user?.id === match.player2?.id;
                          const canEnterMatch = Boolean(match.gameRoomId && isCurrentPlayerMatch && match.status === "pending");

                          return (
                            <div
                              key={match.id}
                              className={`tournament-match-card ${match.winner ? "is-complete" : ""} ${canEnterMatch ? "is-active" : ""}`}
                            >
                              <div className="tournament-match-head">
                                <span>{t("TOURNAMENT_MATCH", { order: match.order })}</span>
                                <span className="status-pill">{getMatchStatusLabel(match.status)}</span>
                              </div>

                              <div className="tournament-duel">
                                <div className={`tournament-player-row ${match.winner?.id === match.player1.id ? "is-winner" : ""}`}>
                                  <span>{match.player1.username}</span>
                                  {match.winner?.id === match.player1.id ? <strong>{t("TOURNAMENT_WIN")}</strong> : null}
                                </div>
                                <div className="tournament-vs">{t("TOURNAMENT_VS")}</div>
                                <div className={`tournament-player-row ${match.winner?.id === match.player2?.id ? "is-winner" : ""}`}>
                                  <span>{match.player2?.username ?? t("TOURNAMENT_BYE")}</span>
                                  {match.winner?.id === match.player2?.id ? <strong>{t("TOURNAMENT_WIN")}</strong> : null}
                                </div>
                              </div>

                              <p className="muted">
                                {match.player2
                                  ? t("TOURNAMENT_WINNER_LABEL", { username: match.winner?.username ?? t("TOURNAMENT_PENDING") })
                                  : t("TOURNAMENT_ADVANCES", { username: match.player1.username })}
                              </p>

                              {match.player2 && match.status === "pending" ? (
                                <p className="muted">{t("TOURNAMENT_AUTO_REGISTER_WINNER")}</p>
                              ) : null}

                              {canEnterMatch ? (
                                <button
                                  type="button"
                                  className="btn-premium"
                                  disabled={actionBusy}
                                  onClick={() => {
                                    const params = new URLSearchParams({
                                      roomId: match.gameRoomId!,
                                      opponent: match.player1.id === user?.id ? match.player2?.username ?? "" : match.player1.username,
                                      source: "tournament",
                                      tournamentId: String(detail.tournament.id),
                                      matchId: String(match.id),
                                    });
                                    navigate(`/play?${params.toString()}`);
                                  }}
                                >
                                  {t("TOURNAMENT_JOIN_ROOM")}
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {message ? <div className={message.type === "error" ? "auth-error" : "auth-success"}>{message.text}</div> : null}
        </article>
      </div>
    </section>
  );
}
