// ===== COMPONENTE PRINCIPAL DE LA APLICACIÓN =====

// Importamos componentes de React Router para la navegación
import { Link, Route, Routes, Navigate } from "react-router-dom";
// Importamos las páginas de nuestra aplicación
import Play from "./pages/Play";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
// Importamos el componente de ruta protegida
import ProtectedRoute from "./components/ProtectedRoute";
// Importamos el contexto de autenticación
import { useAuth } from "./context/AuthContext";
// Importamos hooks de React para manejar efectos y estado
import { useEffect, useState } from "react";

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
  // Estado para almacenar la respuesta del health check del backend
  // Inicialmente muestra "(loading)" mientras espera la respuesta
  const [health, setHealth] = useState<string>("(loading)");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

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
          friend_request_received: "Nueva solicitud de amistad",
          friend_request_accepted: "Aceptaron tu solicitud de amistad",
          friend_request_rejected: "Rechazaron tu solicitud de amistad",
          chat_message_received: "Nuevo mensaje de chat",
          match_invite_received: "Nueva invitacion de partida",
          match_invite_accepted: "Aceptaron tu invitacion de partida",
          match_invite_rejected: "Rechazaron tu invitacion de partida",
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
      } catch (_error) {
        // Ignore malformed payloads.
      }
    };

    return () => {
      ws.close();
    };
  }, [user]);

  // Mostrar loading mientras se verifica autenticación
  if (isLoading) {
    return (
      <div className="app-shell">
        <div className="app-frame">
          <div className="content-wrap">
            <p>Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <Link className="nav-link" to="/">Home</Link>
          <Link className="nav-link" to="/play">Play</Link>

          <div className="user-strip">
            {user ? (
              <>
                <div className="notif-wrap">
                  <button className="notif-btn" onClick={() => setNotifOpen((v) => !v)} type="button">
                    Notifs
                    {notifications.length > 0 && <span className="notif-badge">{notifications.length}</span>}
                  </button>
                  {notifOpen && (
                    <div className="notif-panel">
                      {notifications.length === 0 ? (
                        <div className="notif-item">Sin notificaciones</div>
                      ) : (
                        notifications.map((notif) => (
                          <div key={notif.id} className="notif-item">{notif.text}</div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <Link className="nav-link" to="/profile">Perfil: {user.username}</Link>
                <button className="btn btn-outline" onClick={logout}>Logout</button>
              </>
            ) : (
              <>
                <Link className="nav-link" to="/login">Login</Link>
                <Link className="nav-link" to="/register">Register</Link>
              </>
            )}
          </div>
        </header>

        <main className="content-wrap">
          <Routes>
            <Route
              path="/"
              element={
                <section className="hero">
                  <article className="hero-card">
                    <h1 className="hero-title">Trascendence Arena</h1>
                    <p>
                      Plataforma de Pong con autenticacion, seguridad y sistema social para competir con amigos.
                    </p>
                    <p>
                      Estado backend:
                      {" "}
                      <span className="status-pill">{health}</span>
                    </p>
                    {user ? (
                      <p>Bienvenido {user.username}. Puedes ir a Play o gestionar tu perfil social.</p>
                    ) : (
                      <p>Inicia sesion para desbloquear juego, perfil, amigos y notificaciones en tiempo real.</p>
                    )}
                  </article>

                  <aside className="grid-cards">
                    <div className="feature-card">
                      <h3>Autenticacion segura</h3>
                      <p>Login con JWT, 2FA opcional y gestion de sesion protegida.</p>
                    </div>
                    <div className="feature-card">
                      <h3>Social realtime</h3>
                      <p>Solicitudes de amistad y bloqueos con actualizacion en vivo.</p>
                    </div>
                    <div className="feature-card">
                      <h3>Control de perfil</h3>
                      <p>Edita datos personales, avatar y seguridad desde una sola vista.</p>
                    </div>
                  </aside>
                </section>
              }
            />

            <Route path="/login" element={user ? <Navigate to="/play" replace /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/play" replace /> : <Register />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            <Route
              path="/play"
              element={
                <ProtectedRoute>
                  <Play />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>

        <footer className="footer">
          <div>Transcendence Project</div>
          <div>
            <Link to="/privacy">Privacy Policy</Link>
            {" · "}
            <Link to="/terms">Terms of Service</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}