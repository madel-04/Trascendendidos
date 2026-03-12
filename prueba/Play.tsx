// ===== PÁGINA DEL JUEGO =====
// Esta página contiene el canvas 3D con el juego Pong

// Importamos el componente que renderiza la escena 3D con Three.js
import ThreeCanvas from "../three/ThreeCanvas";

export default function Play() {
  return (
    <div>
      {/* Título de la página */}
      <h2>Play</h2>
      {/* Descripción de lo que contiene */}
      <p>Three.js bootstrap (mesa + palas + bola).</p>
      
      {/* Contenedor del canvas 3D con estilos personalizados */}
      {/* height: 520px → Altura fija para el canvas */}
      {/* borderRadius: 12 → Esquinas redondeadas */}
      {/* overflow: hidden → Corta contenido que salga del contenedor */}
      {/* border: Borde sutil para delimitar el área de juego */}
      <div style={{ height: 520, borderRadius: 12, overflow: "hidden", border: "1px solid #222" }}>
        {/* Componente que crea y anima la escena 3D */}
        <ThreeCanvas />
      </div>
    </div>
  );
}