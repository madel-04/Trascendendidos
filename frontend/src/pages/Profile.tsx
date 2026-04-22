import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import SocialPanel from "../components/SocialPanel";
import { useAuth } from "../context/AuthContext";
import { getLocalBotStats, type LocalBotStats } from "../utils/localGameStats";
import { evaluatePasswordStrength } from "../utils/passwordStrength";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

type ProfileTab = "profile" | "security" | "matches" | "social";
type StatsView = "multiplayer" | "local";

type Achievement = {
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
};

type GameStats = {
  totalPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  ranking: number | null;
  rating: number;
  progression: {
    level: number;
    xp: number;
    currentLevelXp: number;
    nextLevelXp: number;
    progress: number;
  };
  achievements: Achievement[];
};

type MatchHistoryItem = {
  id: string;
  roomId: string;
  opponentUsername: string;
  reason: string;
  scoreFor: number;
  scoreAgainst: number;
  result: "win" | "loss" | "draw";
  endedAt: string;
};

type LeaderboardPlayer = {
  id: number;
  username: string;
  rank: number;
  rating: number;
  totalPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  progression: { level: number };
};

function resolveAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) return avatarUrl;
  return `${API}${avatarUrl}`;
}

function statCard(label: string, value: string | number, color = "var(--ink-strong)") {
  return (
    <div className="profile-stat-card">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

export default function Profile() {
  const { user, token, logout, setCurrentUser } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [localBotStats, setLocalBotStats] = useState<LocalBotStats>(() => getLocalBotStats(user?.id));
  const [statsView, setStatsView] = useState<StatsView>("multiplayer");
  const [loadingStats, setLoadingStats] = useState(false);

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(newPassword, { email: user?.email, username: user?.username }),
    [newPassword, user?.email, user?.username]
  );

  useEffect(() => {
    if (!user) return;
    setTwoFAEnabled(user.twoFAEnabled);
    setUsername(user.username ?? "");
    setDisplayName(user.displayName ?? "");
    setBio(user.bio ?? "");
    setAvatarUrl(user.avatarUrl ?? "");
    setLocalBotStats(getLocalBotStats(user.id));
  }, [user]);

  useEffect(() => {
    if (!token) return;

    const loadGameData = async () => {
      setLoadingStats(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [statsResponse, historyResponse, leaderboardResponse] = await Promise.all([
          fetch(`${API}/api/game/stats`, { headers }),
          fetch(`${API}/api/game/history?limit=10`, { headers }),
          fetch(`${API}/api/game/leaderboard?limit=10`, { headers }),
        ]);

        if (statsResponse.ok) setGameStats(await statsResponse.json());
        if (historyResponse.ok) setMatchHistory((await historyResponse.json()).matches ?? []);
        if (leaderboardResponse.ok) setLeaderboard((await leaderboardResponse.json()).players ?? []);
      } catch (_error) {
        setMessage({ type: "error", text: "No se pudieron cargar las estadisticas de juego" });
      } finally {
        setLoadingStats(false);
      }
    };

    void loadGameData();
  }, [token]);

  const profileValidationError = useMemo(() => {
    if (username.trim().length < 3 || username.trim().length > 50) return "El username debe tener entre 3 y 50 caracteres";
    if (displayName.trim().length > 0 && displayName.trim().length < 2) return "El nombre visible debe tener al menos 2 caracteres";
    if (displayName.trim().length > 80) return "El nombre visible no puede superar 80 caracteres";
    if (bio.trim().length > 280) return "La bio no puede superar 280 caracteres";
    return null;
  }, [bio, displayName, username]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!token || profileValidationError) {
      setMessage({ type: "error", text: profileValidationError ?? "Sesion expirada. Inicia sesion de nuevo" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: username.trim(), displayName: displayName.trim() || undefined, bio: bio.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el perfil");
      setCurrentUser(data.user);
      setMessage({ type: "success", text: "Perfil actualizado correctamente" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error de conexion" });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async () => {
    setMessage(null);
    if (!token || !avatarFile) {
      setMessage({ type: "error", text: "Selecciona una imagen antes de subir" });
      return;
    }
    if (avatarFile.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "El archivo supera el limite de 2MB" });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      const response = await fetch(`${API}/api/auth/profile/avatar`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo subir el avatar");
      setCurrentUser(data.user);
      setAvatarUrl(data.user.avatarUrl ?? "");
      setAvatarFile(null);
      setMessage({ type: "success", text: "Avatar actualizado correctamente" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error de conexion" });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/auth/profile/avatar`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar el avatar");
      setCurrentUser(data.user);
      setAvatarUrl("");
      setAvatarFile(null);
      setMessage({ type: "success", text: "Avatar eliminado" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error de conexion" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!token || newPassword !== confirmNewPassword || newPassword.length < 12 || passwordStrength.level === "weak") {
      setMessage({ type: "error", text: "Revisa la nueva contrasena y sus requisitos de seguridad" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/api/auth/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar la contrasena");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setMessage({ type: "success", text: "Contrasena actualizada correctamente" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error de conexion" });
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2FA = async () => {
    if (!authHeaders) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/auth/2fa/setup`, { method: "POST", headers: authHeaders });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al generar codigo QR");
      setQrCodeUrl(data.qrCodeUrl);
      setSecret(data.secret);
      setShowSetup(true);
      setMessage({ type: "success", text: "Escanea el codigo QR con tu app TOTP" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error de conexion" });
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    if (!authHeaders || verificationCode.length !== 6) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/api/auth/2fa/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ token: verificationCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Codigo incorrecto");
      setTwoFAEnabled(true);
      setShowSetup(false);
      setQrCodeUrl(null);
      setVerificationCode("");
      if (user) setCurrentUser({ ...user, twoFAEnabled: true });
      setMessage({ type: "success", text: "2FA habilitado correctamente" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error de conexion" });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!authHeaders || !confirm("Quieres deshabilitar 2FA?")) return;
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/auth/2fa/disable`, { method: "POST", headers: authHeaders });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al deshabilitar 2FA");
      setTwoFAEnabled(false);
      if (user) setCurrentUser({ ...user, twoFAEnabled: false });
      setMessage({ type: "success", text: "2FA deshabilitado" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error de conexion" });
    } finally {
      setLoading(false);
    }
  };

  const levelProgress = gameStats
    ? Math.round((gameStats.progression.progress / Math.max(1, gameStats.progression.nextLevelXp - gameStats.progression.currentLevelXp)) * 100)
    : 0;

  const multiplayerSummary = {
    totalPlayed: gameStats?.totalPlayed ?? 0,
    wins: gameStats?.wins ?? 0,
    losses: gameStats?.losses ?? 0,
  };

  return (
    <div className="profile-shell">
      <h1 className="page-title">{t("PROFILE")}</h1>

      <div className="profile-tabs">
        {[
          ["profile", t("PROFILE_INFO")],
          ["security", t("SECURITY")],
          ["matches", t("MATCHES")],
          ["social", t("SOCIAL")],
        ].map(([key, label]) => (
          <button key={key} className={`tab-btn ${activeTab === key ? "active" : ""}`} onClick={() => setActiveTab(key as ProfileTab)} type="button">
            {label}
          </button>
        ))}
      </div>

      {message && <div className={`profile-message ${message.type}`}>{message.text}</div>}

      {activeTab === "profile" && (
        <form className="profile-panel" onSubmit={handleProfileSave}>
          <p className="muted">Gestiona tu identidad publica, avatar y bio.</p>
          <label className="auth-field">
            <span className="auth-label">Email</span>
            <input type="email" value={user?.email ?? ""} readOnly />
          </label>
          <label className="auth-field">
            <span className="auth-label">{t("USERNAME")}</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={50} required />
          </label>
          <label className="auth-field">
            <span className="auth-label">{t("DISPLAY_NAME")}</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} />
          </label>
          <label className="auth-field">
            <span className="auth-label">{t("BIO")}</span>
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={4} />
          </label>
          <div className="profile-avatar-row">
            {resolveAvatarUrl(avatarUrl) && <img src={resolveAvatarUrl(avatarUrl) ?? ""} alt="Avatar actual" />}
            <span className="auth-label">{t("AVATAR_IMAGE")}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} />
          </div>
          <div className="split-actions">
            <button className="btn btn-outline" type="button" onClick={handleAvatarUpload} disabled={loading || !avatarFile}>{t("UPLOAD_AVATAR")}</button>
            <button className="btn btn-outline" type="button" onClick={handleAvatarDelete} disabled={loading || !avatarUrl}>{t("DELETE_AVATAR")}</button>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading || !!profileValidationError}>{t("SAVE_CHANGES")}</button>
        </form>
      )}

      {activeTab === "security" && (
        <div className="profile-panel">
          <form className="auth-form" onSubmit={handlePasswordChange}>
            <h2>{t("PASSWORD_SECURITY")}</h2>
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder={t("CURRENT_PASSWORD")} required />
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={t("NEW_PASSWORD")} minLength={12} required />
            <div className="password-meter">
              <div className="password-meter-track">
                <div className={`password-meter-fill ${passwordStrength.level}`} style={{ width: `${(passwordStrength.score / passwordStrength.rules.length) * 100}%` }} />
              </div>
              <div className="password-meter-label">Fortaleza: {passwordStrength.level === "strong" ? "Fuerte" : passwordStrength.level === "medium" ? "Media" : "Debil"}</div>
            </div>
            <input type="password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} placeholder={t("CONFIRM_NEW_PASSWORD")} minLength={12} required />
            <button className="btn btn-primary" type="submit" disabled={loading}>{t("UPDATE_PASSWORD")}</button>
          </form>

          <div className="profile-divider" />
          <h2>Two-Factor Authentication</h2>
          <p className="muted">Anade una capa extra de seguridad a tu cuenta.</p>
          {!twoFAEnabled && !showSetup && <button className="btn btn-primary" type="button" onClick={handleSetup2FA} disabled={loading}>{t("ENABLE_2FA")}</button>}
          {!twoFAEnabled && showSetup && qrCodeUrl && (
            <div className="profile-2fa-box">
              <img src={qrCodeUrl} alt="QR Code for 2FA" />
              <code>{secret}</code>
              <input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} />
              <button className="btn btn-primary" type="button" onClick={handleEnable2FA} disabled={loading || verificationCode.length !== 6}>Verificar y activar</button>
            </div>
          )}
          {twoFAEnabled && <button className="btn btn-outline" type="button" onClick={handleDisable2FA} disabled={loading}>{t("DISABLE_2FA")}</button>}
        </div>
      )}

      {activeTab === "matches" && (
        <div className="profile-panel profile-game-panel">
          <h2>{t("GAME_STATS")}</h2>
          <div className="profile-tabs" style={{ marginBottom: 0 }}>
            {[
              ["multiplayer", t("MULTIPLAYER_STATS")],
              ["local", t("LOCAL_BOT_STATS")],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`tab-btn ${statsView === key ? "active" : ""}`}
                type="button"
                onClick={() => {
                  if (key === "local") setLocalBotStats(getLocalBotStats(user?.id));
                  setStatsView(key as StatsView);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {loadingStats ? <p className="muted">Cargando estadisticas...</p> : (
            <>
              {statsView === "local" && (
                <>
                  <div className="profile-stats-grid">
                    {statCard(t("GAMES_PLAYED"), localBotStats.totalPlayed)}
                    {statCard(t("GAMES_WON"), localBotStats.wins, "#9bf2bd")}
                    {statCard(t("GAMES_LOST"), localBotStats.losses, "#ff8da1")}
                    {statCard("Rival", "Bot", "#f9cb28")}
                  </div>

                  <h3>{t("LOCAL_BOT_HISTORY")}</h3>
                  {localBotStats.matches.length === 0 ? <p className="muted">Todavia no tienes partidas locales registradas en este navegador.</p> : (
                    <div className="match-history-list">
                      {localBotStats.matches.slice(0, 10).map((match) => (
                        <article key={match.id} className={`match-history-card ${match.result}`}>
                          <div><strong>{match.result.toUpperCase()} vs Bot</strong><span>{new Date(match.playedAt).toLocaleString()}</span></div>
                          <p>Dificultad {match.difficulty} · Objetivo {match.targetScore} · Control {match.controlMode === "mouse" ? "raton" : "teclado"}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}

              {statsView === "multiplayer" && (
                <>
              <div className="profile-stats-grid">
                {statCard(t("GAMES_PLAYED"), multiplayerSummary.totalPlayed)}
                {statCard("Ranking", gameStats?.ranking ? `#${gameStats.ranking}` : "Sin rank", "#9ef8ff")}
                {statCard("Rating", gameStats?.rating ?? 1000)}
                {statCard("Nivel", gameStats?.progression.level ?? 1, "#f9cb28")}
                {statCard("Win rate", `${gameStats?.winRate ?? 0}%`, "#9bf2bd")}
                {statCard(t("GAMES_WON"), gameStats?.wins ?? 0, "#9bf2bd")}
                {statCard(t("GAMES_LOST"), gameStats?.losses ?? 0, "#ff8da1")}
              </div>
              <div className="profile-progress">
                <div><strong>Progreso</strong><span>{gameStats?.progression.xp ?? 0} XP</span></div>
                <div className="profile-progress-track"><span style={{ width: `${levelProgress}%` }} /></div>
              </div>

              <h3>Achievements</h3>
              <div className="achievement-grid">
                {(gameStats?.achievements ?? []).map((achievement) => (
                  <article key={achievement.key} className={`achievement-card ${achievement.unlocked ? "unlocked" : ""}`}>
                    <strong>{achievement.unlocked ? "Unlocked" : "Locked"} · {achievement.title}</strong>
                    <p>{achievement.description}</p>
                    <span>{achievement.progress}/{achievement.target}</span>
                  </article>
                ))}
              </div>

              <h3>Match history</h3>
              {matchHistory.length === 0 ? <p className="muted">Todavia no tienes partidas registradas.</p> : (
                <div className="match-history-list">
                  {matchHistory.map((match) => (
                    <article key={match.id} className={`match-history-card ${match.result}`}>
                      <div><strong>{match.result.toUpperCase()} vs @{match.opponentUsername}</strong><span>{new Date(match.endedAt).toLocaleString()}</span></div>
                      <p>1v1 · {match.reason} · {match.scoreFor} - {match.scoreAgainst}</p>
                    </article>
                  ))}
                </div>
              )}

              <h3>Leaderboard</h3>
              <div className="leaderboard-list">
                {leaderboard.map((player) => (
                  <div key={player.id} className={`leaderboard-row ${player.id === user?.id ? "me" : ""}`}>
                    <strong>#{player.rank} @{player.username}</strong>
                    <span>{player.rating} pts · Lvl {player.progression.level} · {player.wins}/{player.losses} · {player.winRate}%</span>
                  </div>
                ))}
              </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "social" && <SocialPanel token={token} />}

      <div className="split-actions">
        <button onClick={() => navigate("/")} className="btn btn-outline" type="button">{t("BACK")}</button>
        <button onClick={logout} className="btn btn-primary" type="button">{t("LOGOUT")}</button>
      </div>
    </div>
  );
}
