import { Player } from './Player';

/**
 * Clase que representa la Pelota en el juego Pong.
 * Gestiona la física, las colisiones con palas/paredes y el renderizado en el canvas.
 */
export class Ball {
  /** La coordenada X del centro de la pelota. */
  public x: number;
  /** La coordenada Y del centro de la pelota. */
  public y: number;
  /** El radio de la pelota en píxeles. */
  public radius: number;
  /** La velocidad en el eje X (horizontal). */
  public vx: number;
  /** La velocidad en el eje Y (vertical). */
  public vy: number;
  /** La velocidad de la pelota, que aumenta con el tiempo. */
  public speed: number;
  /** La velocidad base inicial de la pelota. */
  public baseSpeed: number;
  
  /** Referencia a la anchura del canvas para gestionar reinicios. */
  private canvasWidth: number;
  /** Referencia a la altura del canvas para gestionar colisiones con los bordes. */
  private canvasHeight: number;

  /**
   * Inicializa una nueva instancia de Pelota posicionada en el centro de la pantalla.
   * 
   * @param canvasWidth - La anchura del canvas del juego.
   * @param canvasHeight - La altura del canvas del juego.
   */
  constructor(canvasWidth: number, canvasHeight: number, baseSpeed: number = 7) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.radius = 10;
    this.x = canvasWidth / 2;
    this.y = canvasHeight / 2;
    this.baseSpeed = baseSpeed;
    this.speed = baseSpeed;
    
    // Dirección de velocidad inicial proporcionada a la base
    const proportion = baseSpeed / 7;
    this.vx = (5 * proportion) * (Math.random() > 0.5 ? 1 : -1);
    this.vy = (5 * proportion) * (Math.random() > 0.5 ? 1 : -1);
  }

  /**
   * Actualiza la posición de la pelota basándose en su velocidad actual.
   * También comprueba las colisiones con las paredes superior e inferior (lógica de rebote).
   */
  public update(): void {
    this.x += this.vx;
    this.y += this.vy;

    // Colisión con bordes superior/inferior
    if (this.y - this.radius <= 0) {
      this.y = this.radius; // Corrige la posición para evitar que se atasque
      this.vy = Math.abs(this.vy); // Fuerza la velocidad hacia abajo
    } else if (this.y + this.radius >= this.canvasHeight) {
      this.y = this.canvasHeight - this.radius;
      this.vy = -Math.abs(this.vy); // Fuerza la velocidad hacia arriba
    }
  }

  /**
   * Comprueba si hay una colisión entre la pelota y la pala de un jugador.
   * Si ocurre una colisión, calcula el punto de impacto y ajusta
   * la velocidad y el ángulo de la pelota en consecuencia.
   * 
   * @param player - El objeto Jugador (pala) contra el que comprobar la colisión.
   * @returns `true` si hubo colisión, `false` en caso contrario.
   */
  public checkPlayerCollision(player: Player): boolean {
    // 1. Calcula los límites de la pala y de la pelota
    const playerTop = player.y;
    const playerBottom = player.y + player.height;
    const playerLeft = player.x;
    const playerRight = player.x + player.width;

    const ballTop = this.y - this.radius;
    const ballBottom = this.y + this.radius;
    const ballLeft = this.x - this.radius;
    const ballRight = this.x + this.radius;

    // 2. Realiza una comprobación simple de colisión AABB (Caja delimitadora alineada a los ejes)
    if (
      ballRight > playerLeft &&
      ballBottom > playerTop &&
      ballLeft < playerRight &&
      ballTop < playerBottom
    ) {
      // 3. ¡Colisión detectada! Calcula el ángulo de reflexión
      // ¿Dónde golpeó la pelota a la pala? Normalizar entre -1 y 1
      let collidePoint = this.y - (player.y + player.height / 2);
      collidePoint = collidePoint / (player.height / 2);
      
      // Calcula el ángulo en radianes (Reflexión máxima de 45 grados -> PI/4)
      const angleRad = collidePoint * (Math.PI / 4);

      // 4. Actualiza las direcciones de velocidad basándose en el golpe de la pala
      const direction = (this.x < this.canvasWidth / 2) ? 1 : -1;
      
      this.vx = direction * this.speed * Math.cos(angleRad);
      this.vy = this.speed * Math.sin(angleRad);
      
      // Aumenta ligeramente la velocidad tras cada golpe de pala para una dificultad progresiva
      this.speed += 0.5;
      
      return true;
    }
    
    return false;
  }

  /**
   * Dibuja la pelota en el canvas.
   * Usa un blanco brillante con un aura magenta/cyan dependiendo de su velocidad.
   * 
   * @param ctx - The 2D rendering context of the HTML canvas.
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowBlur = 20;
    // El color del brillo pasa de cyan a magenta a medida que aumenta la velocidad
    ctx.shadowColor = this.vx > 0 ? '#00F0FF' : '#FF003C';
    ctx.fillStyle = '#FFFFFF';
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  }

  /**
   * Restablece la pelota al centro del canvas y aleatoriza su dirección inicial.
   * La velocidad también se restablece a la base inicial.
   */
  public reset(serveTo: 'left' | 'right' = this.vx > 0 ? 'left' : 'right'): void {
    this.x = this.canvasWidth / 2;
    this.y = this.canvasHeight / 2;
    this.speed = this.baseSpeed;
    const proportion = this.baseSpeed / 7;
    this.vx = (serveTo === 'left' ? -1 : 1) * (5 * proportion);
    this.vy = (5 * proportion) * (Math.random() > 0.5 ? 1 : -1);
  }
}
