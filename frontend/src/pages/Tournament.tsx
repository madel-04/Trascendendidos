import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
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
        setMessage({ type: "error", text: data.error ?? "No se pudo cargar la lista de torneos" });
        return;
      }
      setTournaments(data.tournaments ?? []);

      setSelectedTournamentId((current) => {
        if (requestedTournamentId && (data.tournaments ?? []).some((t: TournamentListItem) => t.id === requestedTournamentId)) {
          return requestedTournamentId;
        }
        if (current && (data.tournaments ?? []).some((t: TournamentListItem) => t.id === current)) {
          return current;
        }
        return data.tournaments?.[0]?.id ?? null;
      });
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion cargando torneos" });
    } finally {
      setLoadingList(false);
    }
  }, [authHeaders, token, requestedTournamentId]);

  const loadDetail = useCallback(async (tournamentId: number) => {
    if (!token || !authHeaders) return;
    setLoadingDetail(true);
    try {
      const response = await fetch(`${API}/api/tournament/${tournamentId}`, { headers: authHeaders });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? "No se pudo cargar el torneo" });
        return;
      }
      setDetail(data as TournamentDetail);
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion cargando detalle del torneo" });
    } finally {
      setLoadingDetail(false);
    }
  }, [authHeaders, token]);

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
  }, [selectedTournamentId, loadDetail, setSearchParams]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !authHeaders) return;

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (trimmedName.length < 3) {
      setMessage({ type: "error", text: "El nombre del torneo debe tener al menos 3 caracteres" });
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
        setMessage({ type: "error", text: data.error ?? "No se pudo crear el torneo" });
        return;
      }

      setName("");
      setDescription("");
      setMessage({ type: "success", text: "Torneo creado correctamente" });
      await loadList();
      if (data?.tournament?.id) {
        setSelectedTournamentId(Number(data.tournament.id));
      }
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion al crear torneo" });
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
        setMessage({ type: "error", text: data.error ?? "No se pudo completar la accion" });
        return;
      }

      setEditing(false);
      setMessage({ type: "success", text: data.message ?? "Accion completada" });
      await loadList();
      await loadDetail(selectedTournamentId);
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion ejecutando la accion" });
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
      setMessage({ type: "error", text: "El nombre del torneo debe tener al menos 3 caracteres" });
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
        setMessage({ type: "error", text: data.error ?? "No se pudo actualizar el torneo" });
        return;
      }

      setEditing(false);
      setMessage({ type: "success", text: data.message ?? "Torneo actualizado" });
      await loadList();
      await loadDetail(detail.tournament.id);
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion actualizando el torneo" });
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

  const isParticipant = Boolean(detail?.participants.some((p) => p.userId === user?.id));
  const canJoin = detail?.tournament.status === "open" && !isParticipant && (detail?.participants.length ?? 0) < (detail?.tournament.maxPlayers ?? 0);
  const canStart = Boolean(detail?.tournament.permissions.canStart && (detail?.participants.length ?? 0) >= 2);
  const canEditTournament = Boolean(detail?.tournament.permissions.canEdit);
  const canCancelTournament = Boolean(detail?.tournament.permissions.canCancel);
  const showTournamentActions = detail?.tournament.status === "open" || detail?.tournament.status === "in_progress";
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
          <h2 className="page-title">Torneos</h2>
          <p className="page-subtitle">Sistema de eliminacion directa para 4, 8 o 16 jugadores.</p>

          <form className="tournament-create" onSubmit={handleCreate}>
            <label className="auth-label" htmlFor="tournamentName">Nombre del torneo</label>
            <input
              id="tournamentName"
              className="auth-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Weekend Cup"
              maxLength={120}
            />

            <label className="auth-label" htmlFor="tournamentDescription">Descripcion</label>
            <textarea
              id="tournamentDescription"
              className="auth-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reglas, formato o notas para los participantes"
              maxLength={500}
              rows={4}
            />

            <label className="auth-label" htmlFor="tournamentSize">Tamano del cuadro</label>
            <select
              id="tournamentSize"
              className="auth-input"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value) as 4 | 8 | 16)}
            >
              <option value={4}>4 jugadores</option>
              <option value={8}>8 jugadores</option>
              <option value={16}>16 jugadores</option>
            </select>

            <button className="btn btn-primary" type="submit" disabled={creating || !token}>
              {creating ? "Creando..." : "Crear torneo"}
            </button>
          </form>

          <div className="tournament-list-wrap">
            {loadingList ? <p className="muted">Cargando torneos...</p> : null}
            {!loadingList && tournaments.length === 0 ? <p className="muted">No hay torneos creados aun.</p> : null}
            {tournaments.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`tournament-list-item ${selectedTournamentId === item.id ? "active" : ""}`}
                onClick={() => setSelectedTournamentId(item.id)}
              >
                <div>
                  <strong>{item.name}</strong>
                  <span className="muted">{item.creator.username} · {item.creator.role}</span>
                </div>
                <div>
                  <span className="status-pill">{item.status}</span>
                  <span className="muted">{item.participantsCount}/{item.maxPlayers}</span>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="tournament-column">
          {!selectedTournamentId ? <p className="muted">Selecciona un torneo para ver el detalle.</p> : null}
          {selectedTournamentId && loadingDetail ? <p className="muted">Cargando detalle...</p> : null}

          {detail ? (
            <div className="tournament-detail">
              <div className="tournament-head">
                <div>
                  <h2 className="page-title">{detail.tournament.name}</h2>
                  <p className="page-subtitle">
                    Anfitrion: {detail.tournament.creator.username} · Estado: {detail.tournament.status}
                  </p>
                  <p className="muted">{detail.tournament.description || "Sin descripcion."}</p>
                </div>
                {showTournamentActions ? (
                  <div className="tournament-actions">
                    {canJoin ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={actionBusy}
                        onClick={() => performAction(`/api/tournament/${detail.tournament.id}/join`)}
                      >
                        Unirme
                      </button>
                    ) : null}
                    {canStart ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={actionBusy}
                        onClick={() => performAction(`/api/tournament/${detail.tournament.id}/start`)}
                      >
                        Iniciar
                      </button>
                    ) : null}
                    {canEditTournament ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={actionBusy}
                        onClick={beginEditing}
                      >
                        Editar
                      </button>
                    ) : null}
                    {canCancelTournament ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={actionBusy}
                        onClick={() => performAction(`/api/tournament/${detail.tournament.id}/cancel`)}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {editing ? (
                <form className="tournament-create" onSubmit={handleSaveTournament}>
                  <label className="auth-label" htmlFor="editTournamentName">Nombre del torneo</label>
                  <input
                    id="editTournamentName"
                    className="auth-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={120}
                  />

                  <label className="auth-label" htmlFor="editTournamentDescription">Descripcion</label>
                  <textarea
                    id="editTournamentDescription"
                    className="auth-input"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    maxLength={500}
                    rows={4}
                  />

                  <div className="tournament-actions">
                    <button className="btn btn-primary" type="submit" disabled={actionBusy}>
                      Guardar cambios
                    </button>
                    <button
                      className="btn btn-outline"
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setEditing(false)}
                    >
                      Cerrar
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="tournament-meta-grid">
                <div className="feature-card">
                  <h3>Jugadores</h3>
                  <p>{detail.participants.length} / {detail.tournament.maxPlayers}</p>
                </div>
                <div className="feature-card">
                  <h3>Creado</h3>
                  <p>{formatDate(detail.tournament.createdAt)}</p>
                </div>
                <div className="feature-card">
                  <h3>Campeon</h3>
                  <p>{detail.tournament.championUsername ?? "Aun sin definir"}</p>
                </div>
              </div>

              <section>
                <h3>Participantes</h3>
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
                <h3>Bracket</h3>
                {detail.matches.length === 0 ? <p className="muted">Aun no hay partidas generadas.</p> : null}
                <div className="tournament-bracket">
                  {groupedMatches.map((roundGroup) => (
                    <div key={roundGroup.round} className="tournament-round">
                      <div className="tournament-round-title">Ronda {roundGroup.round}</div>
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
                                <span>Match {match.order}</span>
                                <span className="status-pill">{match.status}</span>
                              </div>

                              <div className="tournament-duel">
                                <div className={`tournament-player-row ${match.winner?.id === match.player1.id ? "is-winner" : ""}`}>
                                  <span>{match.player1.username}</span>
                                  {match.winner?.id === match.player1.id ? <strong>WIN</strong> : null}
                                </div>
                                <div className="tournament-vs">VS</div>
                                <div className={`tournament-player-row ${match.winner?.id === match.player2?.id ? "is-winner" : ""}`}>
                                  <span>{match.player2?.username ?? "Bye"}</span>
                                  {match.winner?.id === match.player2?.id ? <strong>WIN</strong> : null}
                                </div>
                              </div>

                        <p className="muted">
                          {match.player2 ? `Ganador: ${match.winner?.username ?? "Pendiente"}` : `${match.player1.username} pasa de ronda`}
                        </p>

                        {match.player2 && match.status === "pending" ? (
                          <p className="muted">El ganador se registrara automaticamente al terminar la partida.</p>
                        ) : null}

                        {canEnterMatch ? (
                          <button
                                  type="button"
                                  className="btn btn-primary"
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
                            Unirme a la sala
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
