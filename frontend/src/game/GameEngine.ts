import { Player } from './Player';
import { Ball } from './Ball';
import { Board } from './Board';
import { socket } from './socket';

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

  // Lógica de Multijugador
  private isMultiplayer: boolean;
  private side: 'left' | 'right' | undefined;
  private roomId: string | undefined;

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
  constructor(canvas: HTMLCanvasElement, isMultiplayer = false, side?: 'left' | 'right', roomId?: string) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Could not initialize 2D context");
    this.ctx = context;

    this.isMultiplayer = isMultiplayer;
    this.side = side;
    this.roomId = roomId;

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
    this.handlePaddleMoved = this.handlePaddleMoved.bind(this);
    this.handleBallState = this.handleBallState.bind(this);
    this.handleScoreUpdate = this.handleScoreUpdate.bind(this);
  }

  /**
   * Inicia el motor del juego adjuntando escuchadores de eventos y 
   * lanzando la primera solicitud de frame de animación.
   */
  public start(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    if (this.isMultiplayer) {
      socket.on('paddle_moved', this.handlePaddleMoved);
      socket.on('ball_state', this.handleBallState);
      socket.on('score_update', this.handleScoreUpdate);
    }

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

    if (this.isMultiplayer) {
      socket.off('paddle_moved', this.handlePaddleMoved);
      socket.off('ball_state', this.handleBallState);
      socket.off('score_update', this.handleScoreUpdate);
    }
  }

  private handlePaddleMoved(payload: { roomId: string; player: 'left' | 'right'; y: number }): void {
    if (payload.player === 'left') {
      this.player1.y = payload.y;
    } else {
      this.player2.y = payload.y;
    }
  }

  private handleBallState(payload: { x: number; y: number; vx: number; vy: number }): void {
    if (this.side === 'right') {
      this.ball.x = payload.x;
      this.ball.y = payload.y;
      this.ball.vx = payload.vx;
      this.ball.vy = payload.vy;
    }
  }

  private handleScoreUpdate(payload: { left: number; right: number }): void {
    this.player1.score = payload.left;
    this.player2.score = payload.right;
  }

  /**
   * Rastrea cuando se pulsa una tecla hacia abajo.
   */
  private handleKeyDown(e: KeyboardEvent): void {
    this.keysTracker[e.code] = true;
    this.keysTracker[e.key] = true;
    this.keysTracker[e.key.toLowerCase()] = true;
    this.keysTracker[e.key.toUpperCase()] = true;
  }

  /**
   * Rastrea cuando se suelta una tecla.
   */
  private handleKeyUp(e: KeyboardEvent): void {
    this.keysTracker[e.code] = false;
    this.keysTracker[e.key] = false;
    this.keysTracker[e.key.toLowerCase()] = false;
    this.keysTracker[e.key.toUpperCase()] = false;
  }

  /**
   * Procesa las entradas del jugador desde el rastreador de teclas y actualiza
   * las posiciones del jugador en consecuencia.
   */
  private processInputs(): void {
    let moved = false;
    let newY = 0;

    if (!this.isMultiplayer || this.side === 'left') {
      if (this.keysTracker['KeyW'] || this.keysTracker['w'] || this.keysTracker['W']) {
        this.player1.update(-1, this.canvas.height);
        moved = true;
        newY = this.player1.y;
      }
      if (this.keysTracker['KeyS'] || this.keysTracker['s'] || this.keysTracker['S']) {
        this.player1.update(1, this.canvas.height);
        moved = true;
        newY = this.player1.y;
      }
    }

    if (!this.isMultiplayer || this.side === 'right') {
      if (this.keysTracker['ArrowUp']) {
        this.player2.update(-1, this.canvas.height);
        moved = true;
        newY = this.player2.y;
      }
      if (this.keysTracker['ArrowDown']) {
        this.player2.update(1, this.canvas.height);
        moved = true;
        newY = this.player2.y;
      }
    }

    if (this.isMultiplayer && moved && this.roomId && this.side) {
      socket.emit('paddle_move', { roomId: this.roomId, player: this.side, y: newY });
    }
  }

  /**
   * Actualiza la física del estado del juego.
   * Mueve la pelota, comprueba colisiones y registra goles.
   */
  private updatePhysics(): void {
    if (this.isMultiplayer && this.side === 'right') {
      return;
    }

    this.ball.update();

    // Comprobar colisiones de palas
    // Dependiendo de en qué mitad del tablero esté la pelota, comprobamos solo un jugador
    if (this.ball.x < this.canvas.width / 2) {
      this.ball.checkPlayerCollision(this.player1);
    } else {
      this.ball.checkPlayerCollision(this.player2);
    }

    let scoreChanged = false;

    // Comprobar goles (la pelota pasa el borde izquierdo o derecho)
    if (this.ball.x < 0) {
      // ¡El Jugador 2 anota!
      this.player2.increaseScore();
      this.resetAfterGoal();
      scoreChanged = true;
    } else if (this.ball.x > this.canvas.width) {
      // ¡El Jugador 1 anota!
      this.player1.increaseScore();
      this.resetAfterGoal();
      scoreChanged = true;
    }

    if (this.isMultiplayer && this.side === 'left' && this.roomId) {
      socket.emit('ball_state', { roomId: this.roomId, x: this.ball.x, y: this.ball.y, vx: this.ball.vx, vy: this.ball.vy });
      if (scoreChanged) {
        socket.emit('score_update', { roomId: this.roomId, left: this.player1.score, right: this.player2.score });
      }
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
