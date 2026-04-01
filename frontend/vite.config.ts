// ===== CONFIGURACIÓN DE VITE =====
// Vite es un build tool moderno que ofrece:
// - Hot Module Replacement (HMR) instantáneo
// - Build optimizado para producción
// - Soporte nativo para TypeScript, JSX, CSS, etc.

// Importamos la función para definir la configuración con tipos TypeScript
import { defineConfig } from "vite";
// Importamos el plugin oficial de Vite para React
import react from "@vitejs/plugin-react";

// Exportamos la configuración de Vite
export default defineConfig({
  // ===== PLUGINS =====
  // Array de plugins que extienden la funcionalidad de Vite
  plugins: [
    react() // Habilita soporte para JSX/TSX y Fast Refresh de React
  ],
  
  // ===== CONFIGURACIÓN DEL SERVIDOR DE DESARROLLO =====
  server: {
    // host: true → Escucha en todas las interfaces de red (0.0.0.0)
    // Esto es necesario en Docker para que el servidor sea accesible desde fuera del contenedor
    // Sin esto, solo sería accesible dentro del contenedor (localhost)
    host: true,
    
    // port: Puerto donde el servidor de desarrollo escuchará
    // 5173 es el puerto por defecto de Vite
    port: 5173
  }
});