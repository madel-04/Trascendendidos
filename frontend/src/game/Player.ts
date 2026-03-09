/**
 * Clase que representa la pala de un Jugador en el juego Pong.
 * Gestiona las dimensiones, posición, lógica de movimiento y el renderizado.
 */
export class Player {
  /** La anchura de la pala en píxeles. */
  public width: number;
  /** La altura de la pala en píxeles. */
  public height: number;
  /** La coordenada X (horizontal) de la pala. */
  public x: number;
  /** La coordenada Y (vertical) de la pala. */
  public y: number;
  /** La puntuación actual del jugador. */
  public score: number;
  /** La velocidad a la que la pala se mueve hacia arriba o hacia abajo en píxeles por fotograma. */
  public speed: number;
  /** El lado del tablero en el que está el jugador ('left' o 'right'). */
  private side: 'left' | 'right';
  /** El color principal utilizado para dibujar la pala. */
  private color: string;

  /**
   * Inicializa una nueva instancia de Jugador.
   * 
   * @param x - La coordenada X inicial.
   * @param y - La coordenada Y inicial.
   * @param side - El lado del tablero que representa el jugador.
   * @param color - El color de la pala de este jugador (ej. '#00F0FF' para cyan).
   */
  constructor(x: number, y: number, side: 'left' | 'right', color: string) {
    this.width = 16;
    this.height = 100;
    this.x = x;
    this.y = y;
    this.score = 0;
    this.speed = 8;
    this.side = side;
    this.color = color;
  }

  /**
   * Actualiza la posición vertical de la pala.
   * Evita que la pala salga de los límites del canvas.
   * 
   * @param direction - Número que indica la dirección (-1 para arriba, 1 para abajo, 0 parar).
   * @param canvasHeight - La altura total del canvas (utilizada para comprobar los límites).
   */
  public update(direction: number, canvasHeight: number): void {
    if (direction < 0 && this.y > 0) {
      this.y -= this.speed;
    } else if (direction > 0 && this.y + this.height < canvasHeight) {
      this.y += this.speed;
    }
  }

  /**
   * Dibuja la pala del jugador en el CanvasRenderingContext2D dado.
   * Renderiza la pala como un rectángulo redondeado con un efecto de brillo neón.
   * 
   * @param ctx - El contexto de renderizado 2D del canvas HTML.
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    // Configurar efecto de brillo neón
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    
    // Dibujar pala redondeada
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 8);
    ctx.fill();
    ctx.closePath();
    
    ctx.restore();
  }

  /**
   * Incrementa la puntuación del jugador en 1.
   */
  public increaseScore(): void {
    this.score += 1;
  }

  /**
   * Restablece la posición vertical del jugador al centro del canvas.
   * 
   * @param canvasHeight - La altura del canvas para calcular su centro.
   */
  public resetPosition(canvasHeight: number): void {
    this.y = (canvasHeight - this.height) / 2;
  }
}
