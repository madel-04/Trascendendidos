import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { user, token, setCurrentUser } = useAuth();
  const { t } = useTranslation();
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
        setMessage({ type: "error", text: t("ERROR_LOADING_STATS") });
      } finally {
        setLoadingStats(false);
      }
    };

    void loadGameData();
  }, [token]);

  const profileValidationError = useMemo(() => {
    if (username.trim().length < 3 || username.trim().length > 50) return t("ERROR_USERNAME_LENGTH");
    if (displayName.trim().length > 0 && displayName.trim().length < 2) return t("ERROR_DISPLAY_NAME_MIN");
    if (displayName.trim().length > 80) return t("ERROR_DISPLAY_NAME_MAX");
    if (bio.trim().length > 280) return t("ERROR_BIO_MAX");
    return null;
  }, [bio, displayName, username]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!token || profileValidationError) {
      setMessage({ type: "error", text: profileValidationError ?? t("ERROR_SESSION_EXPIRED") });
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
      if (!response.ok) throw new Error(data.error || t("TOURNAMENT_UPDATE_ERROR"));
      setCurrentUser(data.user);
      setMessage({ type: "success", text: t("SUCCESS_PROFILE_UPDATED") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("ERROR_CONNECTION") });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async () => {
    setMessage(null);
    if (!token || !avatarFile) {
      setMessage({ type: "error", text: t("ERROR_SELECT_IMAGE") });
      return;
    }
    if (avatarFile.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: t("ERROR_FILE_TOO_LARGE") });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      const response = await fetch(`${API}/api/auth/profile/avatar`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("TOURNAMENT_CREATE_ERROR"));
      setCurrentUser(data.user);
      setAvatarUrl(data.user.avatarUrl ?? "");
      setAvatarFile(null);
      setMessage({ type: "success", text: t("SUCCESS_AVATAR_UPDATED") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("ERROR_CONNECTION") });
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
      if (!response.ok) throw new Error(data.error || t("TOURNAMENT_ACTION_ERROR"));
      setCurrentUser(data.user);
      setAvatarUrl("");
      setAvatarFile(null);
      setMessage({ type: "success", text: t("SUCCESS_AVATAR_DELETED") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("ERROR_CONNECTION") });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!token || newPassword !== confirmNewPassword || newPassword.length < 12 || passwordStrength.level === "weak") {
      setMessage({ type: "error", text: t("ERROR_PASSWORD_REQUIREMENTS") });
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
      if (!response.ok) throw new Error(data.error || t("TOURNAMENT_UPDATE_ERROR"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setMessage({ type: "success", text: t("SUCCESS_PASSWORD_UPDATED") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("ERROR_CONNECTION") });
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
      if (!response.ok) throw new Error(data.error || t("TOURNAMENT_ACTION_ERROR"));
      setQrCodeUrl(data.qrCodeUrl);
      setSecret(data.secret);
      setShowSetup(true);
      setMessage({ type: "success", text: t("INSTRUCTION_SCAN_QR") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("ERROR_CONNECTION") });
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
      if (!response.ok) throw new Error(data.error || t("READY_ERROR"));
      setTwoFAEnabled(true);
      setShowSetup(false);
      setQrCodeUrl(null);
      setVerificationCode("");
      if (user) setCurrentUser({ ...user, twoFAEnabled: true });
      setMessage({ type: "success", text: t("SUCCESS_2FA_ENABLED") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("ERROR_CONNECTION") });
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
      if (!response.ok) throw new Error(data.error || t("TOURNAMENT_ACTION_ERROR"));
      setTwoFAEnabled(false);
      if (user) setCurrentUser({ ...user, twoFAEnabled: false });
      setMessage({ type: "success", text: t("SUCCESS_2FA_DISABLED") });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : t("ERROR_CONNECTION") });
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

  const getProfileButtonClass = (isActive = false, variant = "") =>
    `btn-premium profile-tab-btn${variant ? ` ${variant}` : ""}${isActive ? " is-active" : ""}`;

  const activeTabPanel = (() => {
    if (activeTab === "profile") {
      return (
        <form className="profile-panel" onSubmit={handleProfileSave}>
          <div className="profile-grid-2col">
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p className="muted">{t("MANAGE_IDENTITY")}</p>
              <label className="auth-field">
                <span className="auth-label">{t("EMAIL")}</span>
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
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%" }}>
              <label className="auth-field">
                <span className="auth-label">{t("BIO")}</span>
                <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} style={{ height: "86px", resize: "none" }} />
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                <span className="auth-label">{t("AVATAR_IMAGE")}</span>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "stretch" }}>
                  {resolveAvatarUrl(avatarUrl) ? (
                    <img src={resolveAvatarUrl(avatarUrl) ?? ""} alt="Avatar actual" style={{ width: "124px", height: "124px", borderRadius: "14px", objectFit: "cover", border: "1px solid rgba(255, 255, 255, 0.16)" }} />
                  ) : (
                    <div style={{ width: "124px", height: "124px", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.16)", background: "rgba(255, 255, 255, 0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>{t("NO_IMAGE")}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, minWidth: "220px", height: "124px" }}>
                    <div style={{ position: "relative", width: "100%" }}>
                      <input id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} style={{ display: "none" }} />
                      <label htmlFor="avatar-upload" className="btn btn-outline" style={{ display: "block", textAlign: "center", cursor: "pointer", padding: "8px 10px", fontSize: "0.9rem", width: "100%", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {avatarFile ? avatarFile.name : t("BROWSE")}
                      </label>
                    </div>
                    <div className="split-actions" style={{ margin: 0 }}>
                      <button className="btn btn-outline" type="button" onClick={handleAvatarUpload} disabled={loading || !avatarFile}>{t("UPLOAD_AVATAR")}</button>
                      <button className="btn btn-outline" type="button" onClick={handleAvatarDelete} disabled={loading || !avatarUrl}>{t("DELETE_AVATAR")}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: "24px" }}>
            <button className="btn-premium" style={{ width: "100%" }} type="submit" disabled={loading || !!profileValidationError}>{t("SAVE_CHANGES")}</button>
          </div>
        </form>
      );
    }

    if (activeTab === "security") {
      return (
        <div className="profile-panel profile-grid-2col">
          <form className="auth-form" onSubmit={handlePasswordChange}>
            <h2>{t("PASSWORD_SECURITY")}</h2>
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder={t("CURRENT_PASSWORD")} required />
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={t("NEW_PASSWORD")} minLength={12} required />
            <div className="password-meter">
              <div className="password-meter-track">
                <div className={`password-meter-fill ${passwordStrength.level}`} style={{ width: `${(passwordStrength.score / passwordStrength.rules.length) * 100}%` }} />
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12 }}>
                {t("STRENGTH_LABEL")}:{" "}
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      passwordStrength.level === "strong"
                        ? "#00ff9d"
                        : passwordStrength.level === "medium"
                        ? "#ffcc00"
                        : "#ff3366",
                  }}
                >
                  {t(`STRENGTH_LEVEL_${passwordStrength.level.toUpperCase()}`)}
                </span>
              </p>
            </div>
            <input type="password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} placeholder={t("CONFIRM_NEW_PASSWORD")} minLength={12} required />
            <button className="btn-premium" type="submit" disabled={loading}>{t("UPDATE_PASSWORD")}</button>
          </form>

          <div style={{ padding: 24, border: "1px solid rgba(255, 255, 255, 0.16)", borderRadius: 12, background: "rgba(8, 10, 20, 0.45)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#fff" }}>{t("TWO_FACTOR_AUTH")}</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--ink-muted)" }}>{t("2FA_DESC")}</p>
            {!twoFAEnabled && !showSetup && <button className="btn-premium secondary" type="button" onClick={handleSetup2FA} disabled={loading}>{t("ENABLE_2FA")}</button>}
            {!twoFAEnabled && showSetup && qrCodeUrl && (
              <div className="profile-2fa-box">
                <img src={qrCodeUrl} alt="QR Code for 2FA" />
                <code>{secret}</code>
                <input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} />
                <button className="btn-premium secondary" type="button" onClick={handleEnable2FA} disabled={loading || verificationCode.length !== 6}>{t("2FA_VERIFY_AND_ACTIVATE")}</button>
              </div>
            )}
            {twoFAEnabled && <button className="btn-premium tertiary" type="button" onClick={handleDisable2FA} disabled={loading}>{t("DISABLE_2FA")}</button>}
          </div>
        </div>
      );
    }

    if (activeTab === "matches") {
      return (
        <div className="profile-panel profile-game-panel">
          <h2>{t("GAME_STATS")}</h2>
          <div className="profile-tabs profile-tabs-compact" style={{ marginBottom: 0 }}>
            {[
              ["multiplayer", t("MULTIPLAYER_STATS")],
              ["local", t("LOCAL_BOT_STATS")],
            ].map(([key, label]) => (
              <button
                key={key}
                className={getProfileButtonClass(statsView === key)}
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
          {loadingStats ? <p className="muted">{t("LOADING_STATS")}</p> : (
            <div key={statsView} className="profile-subview profile-subview-enter">
              {statsView === "local" && (
                <div className="profile-grid-2col">
                  <div>
                    <div className="profile-stats-grid">
                      {statCard(t("GAMES_PLAYED"), localBotStats.totalPlayed)}
                      {statCard(t("GAMES_WON"), localBotStats.wins, "#9bf2bd")}
                      {statCard(t("GAMES_LOST"), localBotStats.losses, "#ff8da1")}
                      {statCard(t("Rival"), t("Bot"), "#f9cb28")}
                    </div>
                  </div>
                  <div>
                    <h3>{t("LOCAL_BOT_HISTORY")}</h3>
                    {localBotStats.matches.length === 0 ? <p className="muted">{t("NO_LOCAL_HISTORY")}</p> : (
                      <div className="match-history-list">
                        {localBotStats.matches.slice(0, 10).map((match) => (
                          <article key={match.id} className={`match-history-card ${match.result}`}>
                            <div><strong>{t(match.result.toUpperCase())} vs {t("BOT")}</strong><span>{new Date(match.playedAt).toLocaleString()}</span></div>
                            <p>{t("DIFFICULTY")} {match.difficulty} · {t("TARGET")} {match.targetScore} · {t("CONTROL")} {match.controlMode === "mouse" ? t("MOUSE_LABEL") : t("KEYBOARD_LABEL")}</p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {statsView === "multiplayer" && (
                <div className="profile-grid-2col">
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                      {[
                        { label: "GAMES_PLAYED", value: multiplayerSummary.totalPlayed },
                        { label: "GAMES_WON", value: multiplayerSummary.wins },
                        { label: "GAMES_LOST", value: multiplayerSummary.losses },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ textAlign: "center", padding: 16, border: "1px solid rgba(255, 255, 255, 0.12)", background: "rgba(255, 255, 255, 0.03)", borderRadius: 8 }}>
                          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "1px", color: "var(--ink-muted)", marginBottom: 8 }}>{t(label)}</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink-strong)" }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16, marginBottom: 32 }}>
                      {[
                        { label: "RANKING", value: gameStats?.ranking ? `#${gameStats.ranking}` : t("NO_RANK") },
                        { label: "RATING", value: Math.floor(gameStats?.rating ?? 1000) },
                        { label: "LEVEL", value: gameStats?.progression.level ?? 1 },
                        { label: "WIN_RATE", value: `${Math.round(gameStats?.winRate ?? 0)}%` },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", border: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(255, 255, 255, 0.02)", borderRadius: 8 }}>
                          <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{t(label)}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-strong)" }}>{value}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: 32 }}>
                      <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "var(--ink-strong)", borderLeft: "3px solid #00f0ff", paddingLeft: 12 }}>{t("ACHIEVEMENTS")}</h3>
                      <div className="achievement-grid">
                        {(gameStats?.achievements ?? []).map((achievement) => (
                          <div key={achievement.key} style={{ display: "flex", gap: 16, padding: 16, border: "1px solid rgba(255, 255, 255, 0.08)", background: achievement.unlocked ? "rgba(0, 240, 255, 0.04)" : "rgba(255, 255, 255, 0.02)", borderRadius: 12, opacity: achievement.unlocked ? 1 : 0.6 }}>
                            <div style={{ fontSize: 24 }}>{achievement.unlocked ? "🏆" : "🔒"}</div>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: "0 0 4px", fontSize: 14, color: "var(--ink-strong)" }}>
                                <strong>{t(achievement.unlocked ? "ACHIEVEMENTS_UNLOCKED" : "ACHIEVEMENTS_LOCKED")} · {t(`ACHIEVEMENT_${achievement.key}_TITLE`)}</strong>
                              </p>
                              <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.4 }}>{t(`ACHIEVEMENT_${achievement.key}_DESC`)}</p>
                              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${(achievement.progress / achievement.target) * 100}%`, background: achievement.unlocked ? "#00f0ff" : "var(--ink-muted)" }} />
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase" }}>
                                <span>{t("PROGRESS")}</span>
                                <span>{achievement.progress} / {achievement.target}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div>
                      <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "var(--ink-strong)", borderLeft: "3px solid #00f0ff", paddingLeft: 12 }}>{t("MATCH_HISTORY")}</h3>
                      {matchHistory.length === 0 ? <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>{t("NO_MATCH_HISTORY")}</p> : (
                        <div className="match-history-list">
                          {matchHistory.map((match) => (
                            <article key={match.id} className={`match-history-card ${match.result}`}>
                              <div><strong>{match.result.toUpperCase()} vs @{match.opponentUsername}</strong><span>{new Date(match.endedAt).toLocaleString()}</span></div>
                              <p style={{ margin: "12px 0 6px", fontSize: 13, color: "var(--ink-muted)" }}>1v1 · {match.reason} · {match.scoreFor} - {match.scoreAgainst}</p>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3>{t("LEADERBOARD")}</h3>
                      <div className="leaderboard-list">
                        {leaderboard.map((player) => (
                          <div key={player.id} className={`leaderboard-row ${player.id === user?.id ? "me" : ""}`}>
                            <strong>#{player.rank} @{player.username}</strong>
                            <span>{player.rating} pts · Lvl {player.progression.level} · {player.wins}/{player.losses} · {player.winRate}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return <SocialPanel token={token} />;
  })();

  return (
    <section className="glass-panel play-hub-panel play-hub-panel-enter page-hub-panel profile-hub-shell">
      <div className="page-hub-layout page-stack">
        <h1 className="page-title">{t("PROFILE")}</h1>

        <div className="profile-tabs">
          {[
            ["profile", t("PROFILE_INFO")],
            ["security", t("SECURITY")],
            ["matches", t("MATCHES")],
            ["social", t("SOCIAL")],
          ].map(([key, label]) => (
            <button key={key} className={getProfileButtonClass(activeTab === key)} onClick={() => setActiveTab(key as ProfileTab)} type="button">
              {label}
            </button>
          ))}
        </div>

        {message && <div className={`profile-message ${message.type}`}>{message.text}</div>}

        <div key={activeTab} className="profile-tab-stage profile-tab-stage-enter">
          {activeTabPanel}
        </div>
      </div>
    </section>
  );
}

