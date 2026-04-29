// ===== COMPONENTE PRINCIPAL DE LA APLICACIÓN =====

// Importamos componentes de React Router para la navegación
import { Link, NavLink, Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
// Importamos las páginas de nuestra aplicación
import Play from "./pages/Play";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Tournament from "./pages/Tournament";
import Organizations from "./pages/Organizations";
import LanguageSwitcher from "./components/LanguageSwitcher";
import HomeShowcase from "./components/HomeShowcase";
import PlayAccessGate from "./components/PlayAccessGate";
// Importamos el componente de ruta protegida
import ProtectedRoute from "./components/ProtectedRoute";
// Importamos el contexto de autenticación
import { useAuth } from "./context/AuthContext";
// Importamos hooks de React para manejar efectos y estado
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Obtenemos la URL base de la API desde las variables de entorno de Vite
// import.meta.env → Variables de entorno disponibles en Vite
// VITE_API_BASE → Se define en docker-compose.yml o .env
// ?? "http://localhost:3000" → Valor por defecto si no está definida
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

type AppNotification = {
  id: string;
  text: string;
  createdAt: number;
};

export default function App() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [, setHealth] = useState<string>("(loading)");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const isPlayRoute = location.pathname.startsWith("/play");
  const isHomeRoute = location.pathname === "/";

  // useEffect: Hook que ejecuta código cuando el componente se monta
  // [] → Array vacío significa que solo se ejecuta una vez al montar
  useEffect(() => {
    // Hacemos una petición HTTP al endpoint de health check
    fetch(`${API}/api/health`)
      .then((r) => r.json())           // Convertimos la respuesta a JSON
      .then((j) => setHealth(JSON.stringify(j)))  // Convertimos el objeto a string y guardamos
      .catch(() => setHealth("(error)"));  // Si falla, mostramos "(error)"
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) return;

    const ws = new WebSocket(`${toWsBaseUrl(API)}/ws?token=${encodeURIComponent(token)}`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.channel !== "social") return;

        const messages: Record<string, string> = {
          friend_request_received: t("FRIEND_REQUEST_RECEIVED"),
          friend_request_accepted: t("FRIEND_REQUEST_ACCEPTED"),
          friend_request_rejected: t("FRIEND_REQUEST_REJECTED"),
          chat_message_received: t("CHAT_MESSAGE_RECEIVED"),
          match_invite_received: t("MATCH_INVITE_RECEIVED"),
          match_invite_accepted: t("MATCH_INVITE_ACCEPTED"),
          match_invite_rejected: t("MATCH_INVITE_REJECTED"),
          tournament_match_ready: "Tu partida de torneo esta lista",
        };

        if (!messages[payload.event]) return;

        setNotifications((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: messages[payload.event],
            createdAt: Date.now(),
          },
          ...prev,
        ].slice(0, 25));

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

      } catch (_error) {
        // Ignore malformed payloads.
      }
    };

    return () => {
      ws.close();
    };
  }, [navigate, user, t]);

  // Mostrar loading mientras se verifica autenticación
  if (isLoading) {
    return (
      <div className={`app-shell${isPlayRoute ? " app-shell-play" : ""}${isHomeRoute ? " app-shell-home" : ""}`}>
        <div className={`app-frame${isPlayRoute ? " app-frame-play" : ""}${isHomeRoute ? " app-frame-home" : ""}`}>
          <div className={`content-wrap${isPlayRoute ? " content-wrap-play" : ""}${isHomeRoute ? " content-wrap-home" : ""}`}>
            <p>{t("LOADING")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${isPlayRoute ? " app-shell-play" : ""}${isHomeRoute ? " app-shell-home" : ""}`}>
      <div className={`app-frame${isPlayRoute ? " app-frame-play" : ""}${isHomeRoute ? " app-frame-home" : ""}`}>
        {!isHomeRoute ? (
          <header className="topbar">
            <NavLink className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`} to="/">{t("HOME")}</NavLink>
            <NavLink className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`} to="/play">{t("MENU")}</NavLink>
            {user ? <NavLink className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`} to="/tournament">{t("TOURNAMENT")}</NavLink> : null}
            {user ? <NavLink className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`} to="/organizations">{t("ORG_NAV")}</NavLink> : null}

            <div className="user-strip">
              {user ? (
                <>
                  <div className="notif-wrap">
                    <button className="notif-btn" onClick={() => setNotifOpen((v) => !v)} type="button">
                      {t("NOTIFS")}
                      {notifications.length > 0 && <span className="notif-badge">{notifications.length}</span>}
                    </button>
                    {notifOpen && (
                      <div className="notif-panel">
                        {notifications.length === 0 ? (
                          <div className="notif-item">{t("NO_NOTIFICATIONS")}</div>
                        ) : (
                          notifications.map((notif) => (
                            <div key={notif.id} className="notif-item">{notif.text}</div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <LanguageSwitcher />
                  <NavLink className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`} to="/profile">{t("PROFILE")}: {user.username}</NavLink>
                  <button className="btn btn-outline" onClick={logout}>{t("LOGOUT")}</button>
                </>
              ) : (
                <>
                  <NavLink className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`} to="/login">{t("LOGIN")}</NavLink>
                  <NavLink className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`} to="/register">{t("REGISTER")}</NavLink>
                </>
              )}
            </div>
          </header>
        ) : null}

        <main className={`content-wrap${isPlayRoute ? " content-wrap-play" : ""}${isHomeRoute ? " content-wrap-home" : ""}`}>
          <Routes>
            <Route
              path="/"
              element={<HomeShowcase />}
            />

            <Route path="/login" element={user ? <Navigate to="/play" replace /> : <Login />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/register" element={user ? <Navigate to="/play" replace /> : <Register />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            <Route
              path="/play"
              element={user ? <Play /> : <PlayAccessGate />}
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tournament"
              element={
                <ProtectedRoute>
                  <Tournament />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizations"
              element={
                <ProtectedRoute>
                  <Organizations />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>

        <footer className={`footer${isHomeRoute ? " footer-home" : ""}`}>
          <div>Transcendence Project</div>
          <div>
            <Link to="/privacy">{t("Privacy Policy")}</Link>
            {" · "}
            <Link to="/terms">{t("Terms of Service")}</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
