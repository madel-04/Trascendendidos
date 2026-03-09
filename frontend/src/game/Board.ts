/**
 * Clase que representa el Tablero de Juego en la aplicación Pong.
 * Responsable de renderizar elementos estáticos como la línea central discontinua
 * y las puntuaciones actuales de ambos jugadores.
 */
export class Board {
  /** La anchura del tablero de juego (normalmente coincide con la anchura del canvas). */
  private width: number;
  /** La altura del tablero de juego (normalmente coincide con la altura del canvas). */
  private height: number;
  /** Color principal usado para las líneas y puntuaciones. */
  private color: string;

  /**
   * Inicializa una nueva instancia de Tablero.
   * 
   * @param width - La anchura del canvas en píxeles.
   * @param height - La altura del canvas en píxeles.
   * @param color - El color de las líneas del tablero y el texto (por defecto: blanco semi-transparente).
   */
  constructor(width: number, height: number, color: string = 'rgba(255, 255, 255, 0.2)') {
    this.width = width;
    this.height = height;
    this.color = color;
  }

  /**
   * Método principal de dibujado que renderiza todos los componentes del tablero en el canvas.
   * 
   * @param ctx - El contexto de renderizado 2D del canvas HTML.
   * @param score1 - El número de puntuación actual para el Jugador 1 (Left).
   * @param score2 - El número de puntuación actual para el Jugador 2 (Right).
   */
  public draw(ctx: CanvasRenderingContext2D, score1: number, score2: number): void {
    ctx.save();

    // 1. Dibuja la línea central discontinua
    ctx.setLineDash([15, 15]);
    ctx.beginPath();
    ctx.moveTo(this.width / 2, 0);
    ctx.lineTo(this.width / 2, this.height);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Restablece las líneas discontinuas para otros dibujos
    ctx.setLineDash([]);
    
    // 2. Dibuja las puntuaciones
    // Configura la tipografía para que coincida con los estilos globales
    ctx.font = '700 80px "Space Grotesk", sans-serif';
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Player 1 score (left)
    ctx.fillText(score1.toString(), this.width / 4, 30);
    
    // Player 2 score (right)
    ctx.fillText(score2.toString(), (this.width / 4) * 3, 30);

    ctx.restore();
  }
}
