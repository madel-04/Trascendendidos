// ===== PUNTO DE ENTRADA DE LA APLICACIÓN REACT =====
// Este es el primer archivo que se ejecuta cuando carga la aplicación

// Importamos React: librería principal para crear interfaces de usuario
import React from "react";
// Importamos ReactDOM: se encarga de renderizar React en el navegador
import ReactDOM from "react-dom/client";
// Importamos BrowserRouter: maneja la navegación entre páginas sin recargar
import { BrowserRouter } from "react-router-dom";
// Importamos nuestro componente principal de la aplicación
import App from "./App";
// Importamos el proveedor de autenticación
import { AuthProvider } from "./context/AuthContext";

// Obtenemos el elemento <div id="root"> del HTML donde montaremos React
// El ! le dice a TypeScript que confiamos en que el elemento existe
// createRoot es el método de React 18 para inicializar la aplicación
ReactDOM.createRoot(document.getElementById("root")!).render(
  // StrictMode: Modo estricto de React que ayuda a detectar problemas
  // - Detecta efectos secundarios inesperados
  // - Advierte sobre APIs obsoletas
  // - Solo afecta en desarrollo, no en producción
  <React.StrictMode>
    {/* BrowserRouter: Habilita la navegación con React Router */}
    {/* Permite usar <Link> y <Routes> para crear una SPA (Single Page App) */}
    <BrowserRouter>
      {/* AuthProvider: Provee el contexto de autenticación a toda la app */}
      <AuthProvider>
        {/* App: Nuestro componente raíz con todas las páginas y lógica */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);