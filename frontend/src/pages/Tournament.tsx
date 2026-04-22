import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type TournamentListItem = {
  id: number;
  name: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  maxPlayers: number;
  participantsCount: number;
  creator: { id: number; username: string };
  championUsername: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
};

type TournamentDetail = {
  tournament: {
    id: number;
    name: string;
    status: "open" | "in_progress" | "completed" | "cancelled";
    maxPlayers: number;
    creator: { id: number; username: string };
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
    player1: { id: number; username: string };
    player2: { id: number; username: string };
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

  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState<4 | 8 | 16>(4);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const authHeaders = useMemo(() => {
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [token]);

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
  }, [authHeaders, token]);

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
      return;
    }
    void loadDetail(selectedTournamentId);
  }, [selectedTournamentId, loadDetail]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !authHeaders) return;

    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      setMessage({ type: "error", text: "El nombre del torneo debe tener al menos 3 caracteres" });
      return;
    }

    setCreating(true);
    setMessage(null);

    try {
      const response = await fetch(`${API}/api/tournament`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ name: trimmedName, maxPlayers }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? "No se pudo crear el torneo" });
        return;
      }

      setName("");
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
      const response = await fetch(`${API}${path}`, {
        method: "POST",
        headers: authHeaders,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? "No se pudo completar la accion" });
        return;
      }

      setMessage({ type: "success", text: data.message ?? "Accion completada" });
      await loadList();
      await loadDetail(selectedTournamentId);
    } catch (_error) {
      setMessage({ type: "error", text: "Error de conexion ejecutando la accion" });
    } finally {
      setActionBusy(false);
    }
  };

  const isParticipant = Boolean(detail?.participants.some((p) => p.userId === user?.id));
  const isCreator = detail?.tournament.creator.id === user?.id;
  const canJoin = detail?.tournament.status === "open" && !isParticipant && (detail?.participants.length ?? 0) < (detail?.tournament.maxPlayers ?? 0);
  const canStart = Boolean(isCreator && detail?.tournament.status === "open" && (detail?.participants.length ?? 0) === (detail?.tournament.maxPlayers ?? 0));

  return (
    <section className="tournament-shell">
      <div className="tournament-grid">
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
                  <span className="muted">{item.creator.username}</span>
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
                    Creador: {detail.tournament.creator.username} · Estado: {detail.tournament.status}
                  </p>
                </div>
                <div className="tournament-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={!canJoin || actionBusy}
                    onClick={() => performAction(`/api/tournament/${detail.tournament.id}/join`)}
                  >
                    Unirme
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canStart || actionBusy}
                    onClick={() => performAction(`/api/tournament/${detail.tournament.id}/start`)}
                  >
                    Iniciar
                  </button>
                </div>
              </div>

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
                <div className="tournament-matches">
                  {detail.matches.map((match) => {
                    const canReport =
                      detail.tournament.status === "in_progress" &&
                      match.status === "pending" &&
                      (user?.id === detail.tournament.creator.id || user?.id === match.player1.id || user?.id === match.player2.id);

                    return (
                      <div key={match.id} className="feature-card">
                        <h4>Ronda {match.round} · Match {match.order}</h4>
                        <p>{match.player1.username} vs {match.player2.username}</p>
                        <p>Estado: {match.status}</p>
                        <p>Ganador: {match.winner?.username ?? "Pendiente"}</p>

                        {canReport ? (
                          <div className="tournament-actions">
                            <button
                              type="button"
                              className="btn btn-outline"
                              disabled={actionBusy}
                              onClick={() =>
                                performAction(
                                  `/api/tournament/${detail.tournament.id}/matches/${match.id}/report`,
                                  { winnerUserId: match.player1.id }
                                )
                              }
                            >
                              Gana {match.player1.username}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline"
                              disabled={actionBusy}
                              onClick={() =>
                                performAction(
                                  `/api/tournament/${detail.tournament.id}/matches/${match.id}/report`,
                                  { winnerUserId: match.player2.id }
                                )
                              }
                            >
                              Gana {match.player2.username}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
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
