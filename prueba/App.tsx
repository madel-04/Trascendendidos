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

export default function App() {
  const { user, logout, isLoading } = useAuth();
  // Estado para almacenar la respuesta del health check del backend
  // Inicialmente muestra "(loading)" mientras espera la respuesta
  const [health, setHealth] = useState<string>("(loading)");

  // useEffect: Hook que ejecuta código cuando el componente se monta
  // [] → Array vacío significa que solo se ejecuta una vez al montar
  useEffect(() => {
    // Hacemos una petición HTTP al endpoint de health check
    fetch(`${API}/api/health`)
      .then((r) => r.json())           // Convertimos la respuesta a JSON
      .then((j) => setHealth(JSON.stringify(j)))  // Convertimos el objeto a string y guardamos
      .catch(() => setHealth("(error)"));  // Si falla, mostramos "(error)"
  }, []);

  // Mostrar loading mientras se verifica autenticación
  if (isLoading) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    // Contenedor principal con estilos en línea
    <div style={{ fontFamily: "system-ui", padding: 16 }}>
      {/* ===== HEADER: Menú de navegación ===== */}
      {/* Link: Componente de React Router para navegar sin recargar la página */}
      <header style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Link to="/">Home</Link>
        <Link to="/play">Play</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        
        {/* Mostrar información del usuario si está autenticado */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          {user ? (
            <>
              <Link to="/profile">👤 {user.username}</Link>
              <button onClick={logout} style={{ padding: "4px 12px", cursor: "pointer" }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </header>

      {/* ===== ROUTES: Define las rutas y qué componente renderizar ===== */}
      {/* Cada <Route> asocia una URL con un componente */}
      <Routes>
        {/* Ruta principal (/) - Página de inicio */}
        <Route
          path="/"
          element={
            <div>
              <h1>Transcendence</h1>
              {/* Mostramos el estado del backend obtenido del health check */}
              <p>Backend health: {health}</p>
              {user ? (
                <p>Bienvenido, {user.username}! 🎮</p>
              ) : (
                <p>Por favor, inicia sesión para jugar.</p>
              )}
            </div>
          }
        />
        
        {/* Rutas públicas */}
        <Route path="/login" element={user ? <Navigate to="/play" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/play" replace /> : <Register />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        
        {/* Rutas protegidas - Requieren autenticación */}
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

      {/* ===== FOOTER: Enlaces legales ===== */}
      <footer style={{ marginTop: 32, borderTop: "1px solid #ddd", paddingTop: 12 }}>
        <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Service</Link>
      </footer>
    </div>
  );
}