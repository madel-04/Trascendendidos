// ===== COMPONENTE PRINCIPAL DE LA APLICACIÓN =====

// Importamos componentes de React Router para la navegación
import { Link, Route, Routes } from "react-router-dom";
// Importamos las páginas de nuestra aplicación
import Play from "./pages/Play";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
// Importamos hooks de React para manejar efectos y estado
import { useEffect, useState } from "react";

// Obtenemos la URL base de la API desde las variables de entorno de Vite
// import.meta.env → Variables de entorno disponibles en Vite
// VITE_API_BASE → Se define en docker-compose.yml o .env
// ?? "http://localhost:3000" → Valor por defecto si no está definida
const API = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export default function App() {
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

  return (
    // Contenedor principal con estilos en línea
    <div style={{ fontFamily: "system-ui", padding: 16 }}>
      {/* ===== HEADER: Menú de navegación ===== */}
      {/* Link: Componente de React Router para navegar sin recargar la página */}
      <header style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link to="/">Home</Link>
        <Link to="/play">Play</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
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
            </div>
          }
        />
        {/* Ruta /play - Página del juego con Three.js */}
        <Route path="/play" element={<Play />} />
        {/* Ruta /privacy - Política de privacidad */}
        <Route path="/privacy" element={<Privacy />} />
        {/* Ruta /terms - Términos de servicio */}
        <Route path="/terms" element={<Terms />} />
      </Routes>

      {/* ===== FOOTER: Enlaces legales ===== */}
      <footer style={{ marginTop: 32, borderTop: "1px solid #ddd", paddingTop: 12 }}>
        <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Service</Link>
      </footer>
    </div>
  );
}