import { Player } from './Player';
import { Ball } from './Ball';
import { Board } from './Board';

/**
 * 
 * GameEngine es el controlador principal para el juego Pong.
 * Gestiona el bucle principal del juego mediante requestAnimationFrame,
 * maneja la entrada del teclado del usuario de forma fiable, y orquesta las actualizaciones
 * y el renderizado de las clases Jugador, Pelota y Tablero.
 */
export class GameEngine {
  /** El elemento HTML5 Canvas donde se dibuja el juego. */
  private canvas: HTMLCanvasElement;
  /** El contexto de renderizado 2D obtenido del canvas. */
  private ctx: CanvasRenderingContext2D;
  
  /** El ID devuelto por requestAnimationFrame para permitir cancelarlo. */
  private animationFrameId: number | null = null;

  // Entidades del Juego
  private player1: Player;
  private player2: Player;
  private ball: Ball;
  private board: Board;

  /** 
   * Un objeto de mapeo para rastrear qué teclas están pulsadas actualmente.
   * Usamos cadenas genéricas como 'w', 's', 'ArrowUp', 'ArrowDown'.
   */
  private keysTracker: { [key: string]: boolean } = {};

  /**
   * Inicializa el GameEngine y sus entidades.
   * Vincula los escuchadores de eventos del teclado para rastrear la entrada.
   * 
   * @param canvas - El elemento canvas objetivo para renderizar el juego.
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Could not initialize 2D context");
    this.ctx = context;

    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Instancia las entidades del juego
    // P1 a la izquierda (Cyan), P2 a la derecha (Magenta)
    this.player1 = new Player(30, ch / 2 - 50, 'left', '#00F0FF');
    this.player2 = new Player(cw - 30 - 16, ch / 2 - 50, 'right', '#FF003C');
    this.ball = new Ball(cw, ch);
    this.board = new Board(cw, ch);

    // Vincula los métodos para asegurar que el contexto `this` se preserve en los eventos
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
  }

  /**
   * Inicia el motor del juego adjuntando escuchadores de eventos y 
   * lanzando la primera solicitud de frame de animación.
   */
  public start(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  /**
   * Detiene el bucle del juego y elimina los escuchadores de eventos de la ventana 
   * para limpiar la memoria cuando el componente se desmonta.
   */
  public stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  /**
   * Rastrea cuando se pulsa una tecla hacia abajo.
   */
  private handleKeyDown(e: KeyboardEvent): void {
    this.keysTracker[e.key] = true;
  }

  /**
   * Rastrea cuando se suelta una tecla.
   */
  private handleKeyUp(e: KeyboardEvent): void {
    this.keysTracker[e.key] = false;
  }

  /**
   * Procesa las entradas del jugador desde el rastreador de teclas y actualiza
   * las posiciones del jugador en consecuencia.
   */
  private processInputs(): void {
    // Controles del Jugador 1 (W/S)
    if (this.keysTracker['w'] || this.keysTracker['W']) {
      this.player1.update(-1, this.canvas.height);
    }
    if (this.keysTracker['s'] || this.keysTracker['S']) {
      this.player1.update(1, this.canvas.height);
    }

    // Controles del Jugador 2 (Flechas Arriba/Abajo)
    if (this.keysTracker['ArrowUp']) {
      this.player2.update(-1, this.canvas.height);
    }
    if (this.keysTracker['ArrowDown']) {
      this.player2.update(1, this.canvas.height);
    }
  }

  /**
   * Actualiza la física del estado del juego.
   * Mueve la pelota, comprueba colisiones y registra goles.
   */
  private updatePhysics(): void {
    this.ball.update();

    // Comprobar colisiones de palas
    // Dependiendo de en qué mitad del tablero esté la pelota, comprobamos solo un jugador
    if (this.ball.x < this.canvas.width / 2) {
      this.ball.checkPlayerCollision(this.player1);
    } else {
      this.ball.checkPlayerCollision(this.player2);
    }

    // Comprobar goles (la pelota pasa el borde izquierdo o derecho)
    if (this.ball.x < 0) {
      // ¡El Jugador 2 anota!
      this.player2.increaseScore();
      this.resetAfterGoal();
    } else if (this.ball.x > this.canvas.width) {
      // ¡El Jugador 1 anota!
      this.player1.increaseScore();
      this.resetAfterGoal();
    }
  }

  /**
   * Restablece las posiciones del tablero, pelota y jugador tras un gol.
   */
  private resetAfterGoal(): void {
    this.ball.reset();
    this.player1.resetPosition(this.canvas.height);
    this.player2.resetPosition(this.canvas.height);
  }

  /**
   * Limpia el canvas actual y ordena a todas las entidades dibujarse.
   */
  private draw(): void {
    // Limpia todo el canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Dibuja los elementos
    this.board.draw(this.ctx, this.player1.score, this.player2.score);
    this.player1.draw(this.ctx);
    this.player2.draw(this.ctx);
    this.ball.draw(this.ctx);
  }

  /**
   * El bucle central del juego ejecutado unas 60 veces por segundo.
   * Patrón: Entrada -> Actualizar -> Dibujar -> Repetir
   */
  private gameLoop(): void {
    this.processInputs();
    this.updatePhysics();
    this.draw();

    // Solicita el siguiente frame para mantener el bucle en marcha
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }
}
