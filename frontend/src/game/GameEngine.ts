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
  private localControlMode: 'keyboard' | 'mouse';
  private localPlayerSide: 'left' | 'right';
  private mouseY: number | null = null;
  private isPaused = false;
  private isGameOver = false;

  /** Callback para notificar cuando la partida ha terminado */
  public onMatchEnded?: (winner: 'left' | 'right') => void;
  public targetScore: number = 5;

  /**  
   * Un objeto de mapeo para rastrear qué teclas están pulsadas actualmente.
   * Usamos cadenas genéricas como 'w', 's', 'ArrowUp', 'ArrowDown'.
   */
  private keysTracker: { [key: string]: boolean } = {};

  // Dificultad para IA en Modo Local
  private aiSpeedMod: number = 0.55;

  /** 
   * Inicializa el motor del juego y sus entidades.
   * 
   * @param canvas - El elemento canvas objetivo para renderizar el juego.
   */
  constructor(
    canvas: HTMLCanvasElement, 
    isMultiplayer = false, 
    side?: 'left' | 'right', 
    roomId?: string, 
    onMatchEnded?: (winner: 'left' | 'right') => void,
    settings?: { targetScore: number; difficulty: string },
    localControlMode: 'keyboard' | 'mouse' = 'keyboard',
    localPlayerSide: 'left' | 'right' = 'right'
  ) {
    this.canvas = canvas;
    this.onMatchEnded = onMatchEnded;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Could not initialize 2D context");
    this.ctx = context;

    this.isMultiplayer = isMultiplayer;
    this.side = side;
    this.roomId = roomId;
    this.localControlMode = localControlMode;
    this.localPlayerSide = localPlayerSide;

    this.keysTracker = {};

    // Configuración Base y Mapeo de Dificultad Dinámico
    let pHeight = 130;
    let bSpeed = 5.5;
    this.targetScore = settings?.targetScore || 5;

    // Solo afectamos parámetros de velocidad/pala en el entorno local offline
    if (!this.isMultiplayer && settings) {
      if (settings.difficulty === 'Intermediate') { pHeight = 90; bSpeed = 7.5; this.aiSpeedMod = 0.65; }
      if (settings.difficulty === 'Expert') { pHeight = 60; bSpeed = 10; this.aiSpeedMod = 0.80; }
    }

    this.player1 = new Player(10, (this.canvas.height - pHeight) / 2, 'left', '#00F0FF');
    this.player1.height = pHeight;
    this.player2 = new Player(this.canvas.width - 26, (this.canvas.height - pHeight) / 2, 'right', '#FF003C');
    this.player2.height = pHeight;
    this.ball = new Ball(this.canvas.width, this.canvas.height, bSpeed);
    this.board = new Board(this.canvas.width, this.canvas.height);

    // Vincula los métodos para asegurar que el contexto `this` se preserve en los eventos
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
    this.handlePaddleMoved = this.handlePaddleMoved.bind(this);
    this.handleBallState = this.handleBallState.bind(this);
    this.handleScoreUpdate = this.handleScoreUpdate.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
  }

  /**
   * Inicia el motor del juego adjuntando escuchadores de eventos y 
   * lanzando la primera solicitud de frame de animación.
   */
  public start(): void {
    this.isPaused = false;
    this.isGameOver = false;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    if (!this.isMultiplayer && this.localControlMode === 'mouse') {
      this.canvas.addEventListener('mousemove', this.handleMouseMove);
      this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    }
    
    if (this.isMultiplayer) {
      socket.on('paddle_moved', this.handlePaddleMoved);
      socket.on('ball_state', this.handleBallState);
      socket.on('score_update', this.handleScoreUpdate);
    }

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  public pause(): void {
    if (this.isMultiplayer || this.isPaused || this.isGameOver) {
      return;
    }

    this.isPaused = true;
    this.keysTracker = {};
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public resume(): void {
    if (this.isMultiplayer || !this.isPaused || this.isGameOver) {
      return;
    }

    this.isPaused = false;
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  /**
   * Detiene el bucle del juego y elimina los escuchadores de eventos de la ventana 
   * para limpiar la memoria cuando el componente se desmonta.
   */
  public stop(): void {
    this.isPaused = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    
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
    if (this.side === 'right') { // Solo el right actualiza la pelota con lo que dicta el left
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

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const scaleY = this.canvas.height / rect.height;
    this.mouseY = (e.clientY - rect.top) * scaleY;
  }

  private handleMouseLeave(): void {
    this.mouseY = null;
  }

  /**
   * Rastrea cuando se pulsa una tecla hacia abajo.
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // Evitar el comportamiento por defecto (ej. scroll) de las teclas de movimiento
    if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S', ' '].includes(e.key)) {
      e.preventDefault();
    }
    
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

    const upPressed = this.keysTracker['ArrowUp'] || this.keysTracker['w'] || this.keysTracker['W'] || this.keysTracker['KeyW'];
    const downPressed = this.keysTracker['ArrowDown'] || this.keysTracker['s'] || this.keysTracker['S'] || this.keysTracker['KeyS'];

    if (this.isMultiplayer) {
      if (this.side === 'left') {
        if (upPressed) { this.player1.update(-1, this.canvas.height); moved = true; newY = this.player1.y; }
        if (downPressed) { this.player1.update(1, this.canvas.height); moved = true; newY = this.player1.y; }
      } else if (this.side === 'right') {
        if (upPressed) { this.player2.update(-1, this.canvas.height); moved = true; newY = this.player2.y; }
        if (downPressed) { this.player2.update(1, this.canvas.height); moved = true; newY = this.player2.y; }
      }
    } else {
      const humanPlayer = this.localPlayerSide === 'left' ? this.player1 : this.player2;
      const botPlayer = this.localPlayerSide === 'left' ? this.player2 : this.player1;
      const isBotOnLeft = this.localPlayerSide === 'right';
      const botIsTargeted = isBotOnLeft ? this.ball.vx < 0 : this.ball.vx > 0;
      const paddleCenter = botPlayer.y + botPlayer.height / 2;

      if (botIsTargeted) {
        if (this.ball.y < paddleCenter - 10) {
          botPlayer.update(-this.aiSpeedMod, this.canvas.height);
        } else if (this.ball.y > paddleCenter + 10) {
          botPlayer.update(this.aiSpeedMod, this.canvas.height);
        }
      }

      if (this.localControlMode === 'mouse') {
        if (this.mouseY !== null) {
          const centeredY = this.mouseY - humanPlayer.height / 2;
          humanPlayer.y = Math.min(Math.max(centeredY, 0), this.canvas.height - humanPlayer.height);
        }
      } else {
        if (upPressed) {
          humanPlayer.update(-1, this.canvas.height);
        }
        if (downPressed) {
          humanPlayer.update(1, this.canvas.height);
        }
      }
    }

    if (this.isMultiplayer && moved && this.roomId) {
      // Limit emission rate or just emit every frame. 
      // Emitting 60fps might be too much, but for Hito 2 it'll work locally ok.
      socket.emit('paddle_move', { roomId: this.roomId, player: this.side, y: newY });
    }
  }

  /**
   * Actualiza la física del estado del juego.
   * Mueve la pelota, comprueba colisiones y registra goles.
   */
  private updatePhysics(): void {
    // Si estamos en multijugador y somos el de la derecha, somos meros espectadores físicos
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

    // Comprobar ganador del target
    let winner: 'left' | 'right' | null = null;
    if (this.player1.score >= this.targetScore) winner = 'left';
    else if (this.player2.score >= this.targetScore) winner = 'right';

    if (winner) {
      if (this.onMatchEnded) this.onMatchEnded(winner);
      // En multijugador, delegamos al host notificar al servidor para oficializar la victoria
      if (this.isMultiplayer && this.side === 'left') {
        socket.emit('game_over', { winner, left: this.player1.score, right: this.player2.score });
      }
    }

    if (this.isMultiplayer && this.side === 'left') {
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
    if (this.isPaused) {
      this.animationFrameId = null;
      return;
    }

    this.processInputs();
    this.updatePhysics();
    this.draw();

    // Detener animación si alguien alcanzó la marca ganadora
    if (this.player1.score >= this.targetScore || this.player2.score >= this.targetScore) {
      this.isGameOver = true;
      this.animationFrameId = null;
      return; 
    }

    // Solicita el siguiente frame para mantener el bucle en marcha
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }
}
