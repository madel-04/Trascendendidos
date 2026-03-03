# Diseño: Pong 3D para 4 Jugadores

## 📐 Configuración de la Arena

### Dimensiones
- **Mesa**: 30 × 30 unidades (cuadrada)
- **Altura mesa**: 1 unidad
- **Palas**: 1.5 (ancho) × 1 (alto) × 6 (largo)
- **Bola**: Radio 0.6
- **Paredes**: 30 × 1.5 × 0.5 (altura × largo × grosor)

### Posiciones Iniciales

```typescript
// Palas (4 jugadores en cruz)
const paddle1 = { x: 0, y: 0.5, z: -14 };  // Sur (Bottom)
const paddle2 = { x: 14, y: 0.5, z: 0 };   // Este (Right)
const paddle3 = { x: 0, y: 0.5, z: 14 };   // Norte (Top)
const paddle4 = { x: -14, y: 0.5, z: 0 };  // Oeste (Left)

// Bola (centro)
const ball = { x: 0, y: 0.6, z: 0 };

// Paredes (4 bordes)
const wallTop = { x: 0, y: 0.75, z: 15.25 };
const wallBottom = { x: 0, y: 0.75, z: -15.25 };
const wallLeft = { x: -15.25, y: 0.75, z: 0 };
const wallRight = { x: 15.25, y: 0.75, z: 0 };
```

## 🎨 Colores por Jugador

```typescript
const playerColors = {
  player1: 0x00ff00, // Verde
  player2: 0xff0000, // Rojo
  player3: 0x0000ff, // Azul
  player4: 0xffff00, // Amarillo
};
```

## 🎯 Sistema de Colisiones

### Detección de Gol

Un jugador pierde un punto cuando la bola cruza su línea:
- **Jugador 1 pierde**: bola.z < -15
- **Jugador 2 pierde**: bola.x > 15
- **Jugador 3 pierde**: bola.z > 15
- **Jugador 4 pierde**: bola.x < -15

### Rebotes

```typescript
// Rebote con palas (todas orientadas hacia el centro)
if (colisionConPala) {
  // Invertir dirección perpendicular a la pala
  // Añadir efecto según posición del impacto
}

// Rebote con paredes laterales
if (colisionConPared) {
  // Invertir componente correspondiente
  if (paredVertical) ball.speedX *= -1;
  if (paredHorizontal) ball.speedZ *= -1;
}
```

## 🕹️ Controles

### Jugador 1 (Bottom)
- **Movimiento**: `A` (izquierda), `D` (derecha)
- **Eje**: X (horizontal)

### Jugador 2 (Right)
- **Movimiento**: `↑` (arriba), `↓` (abajo)
- **Eje**: Z (vertical)

### Jugador 3 (Top)
- **Movimiento**: `J` (izquierda), `L` (derecha)
- **Eje**: X (horizontal)

### Jugador 4 (Left)
- **Movimiento**: `W` (arriba), `S` (abajo)
- **Eje**: Z (vertical)

## 📦 Estructura de Código

### 1. Tipos TypeScript

```typescript
interface Player {
  id: number;
  position: { x: number; y: number; z: number };
  paddle: THREE.Mesh;
  score: number;
  color: number;
  axis: 'x' | 'z'; // Eje de movimiento
  keys: { left: string; right: string };
}

interface GameState {
  players: Player[];
  ball: {
    mesh: THREE.Mesh;
    velocity: { x: number; y: number; z: number };
    speed: number;
  };
  walls: THREE.Mesh[];
  scores: number[];
}
```

### 2. Inicialización de Jugadores

```typescript
const createPlayers = (): Player[] => [
  {
    id: 1,
    position: { x: 0, y: 0.5, z: -14 },
    score: 0,
    color: 0x00ff00,
    axis: 'x',
    keys: { left: 'a', right: 'd' },
  },
  {
    id: 2,
    position: { x: 14, y: 0.5, z: 0 },
    score: 0,
    color: 0xff0000,
    axis: 'z',
    keys: { left: 'ArrowDown', right: 'ArrowUp' },
  },
  {
    id: 3,
    position: { x: 0, y: 0.5, z: 14 },
    score: 0,
    color: 0x0000ff,
    axis: 'x',
    keys: { left: 'j', right: 'l' },
  },
  {
    id: 4,
    position: { x: -14, y: 0.5, z: 0 },
    score: 0,
    color: 0xffff00,
    axis: 'z',
    keys: { left: 's', right: 'w' },
  },
];
```

### 3. Creación de Palas

```typescript
const createPaddle = (player: Player): THREE.Mesh => {
  const geometry = new THREE.BoxGeometry(
    player.axis === 'x' ? 6 : 1.5,  // Si se mueve en X, pala horizontal
    1,
    player.axis === 'z' ? 6 : 1.5   // Si se mueve en Z, pala vertical
  );
  const material = new THREE.MeshStandardMaterial({ 
    color: player.color,
    metalness: 0.3,
    roughness: 0.7
  });
  const paddle = new THREE.Mesh(geometry, material);
  paddle.position.set(player.position.x, player.position.y, player.position.z);
  return paddle;
};
```

### 4. Física de la Bola

```typescript
const updateBall = (ball: GameState['ball'], deltaTime: number) => {
  // Movimiento básico
  ball.mesh.position.x += ball.velocity.x * deltaTime;
  ball.mesh.position.y += ball.velocity.y * deltaTime;
  ball.mesh.position.z += ball.velocity.z * deltaTime;

  // Límites (detección de gol)
  if (Math.abs(ball.mesh.position.x) > 15) {
    // Gol en jugador 2 o 4
    const losingPlayer = ball.mesh.position.x > 0 ? 2 : 4;
    handleGoal(losingPlayer);
  }
  
  if (Math.abs(ball.mesh.position.z) > 15) {
    // Gol en jugador 1 o 3
    const losingPlayer = ball.mesh.position.z > 0 ? 3 : 1;
    handleGoal(losingPlayer);
  }
};
```

### 5. Colisiones con Palas

```typescript
const checkPaddleCollision = (
  ball: THREE.Mesh,
  paddle: THREE.Mesh,
  velocity: { x: number; y: number; z: number }
) => {
  const ballBox = new THREE.Box3().setFromObject(ball);
  const paddleBox = new THREE.Box3().setFromObject(paddle);

  if (ballBox.intersectsBox(paddleBox)) {
    // Calcular punto de impacto relativo al centro de la pala
    const impactPoint = ball.position.clone().sub(paddle.position);
    
    // Añadir efecto según posición del impacto
    const impactFactor = 0.3;
    
    // Invertir velocidad perpendicular
    if (Math.abs(paddle.position.z) > 10) {
      // Palas horizontales (arriba/abajo)
      velocity.z *= -1;
      velocity.x += impactPoint.x * impactFactor;
    } else {
      // Palas verticales (izquierda/derecha)
      velocity.x *= -1;
      velocity.z += impactPoint.z * impactFactor;
    }
    
    return true;
  }
  return false;
};
```

### 6. Sistema de Puntuación

```typescript
const handleGoal = (losingPlayer: number, gameState: GameState) => {
  // Todos los demás jugadores ganan un punto
  gameState.players.forEach((player) => {
    if (player.id !== losingPlayer) {
      player.score++;
    }
  });
  
  // Verificar ganador
  const winner = gameState.players.find(p => p.score >= 10);
  if (winner) {
    endGame(winner);
  } else {
    resetBall(gameState.ball);
  }
};
```

### 7. Controles de Teclado

```typescript
const keysPressed = new Set<string>();

window.addEventListener('keydown', (e) => {
  keysPressed.add(e.key.toLowerCase());
});

window.addEventListener('keyup', (e) => {
  keysPressed.delete(e.key.toLowerCase());
});

const updatePlayerMovement = (player: Player, deltaTime: number) => {
  const speed = 10; // Unidades por segundo
  const maxPosition = 12; // Límite de movimiento

  if (keysPressed.has(player.keys.left)) {
    if (player.axis === 'x') {
      player.paddle.position.x = Math.max(
        -maxPosition,
        player.paddle.position.x - speed * deltaTime
      );
    } else {
      player.paddle.position.z = Math.max(
        -maxPosition,
        player.paddle.position.z - speed * deltaTime
      );
    }
  }

  if (keysPressed.has(player.keys.right)) {
    if (player.axis === 'x') {
      player.paddle.position.x = Math.min(
        maxPosition,
        player.paddle.position.x + speed * deltaTime
      );
    } else {
      player.paddle.position.z = Math.min(
        maxPosition,
        player.paddle.position.z + speed * deltaTime
      );
    }
  }
};
```

## 📷 Configuración de Cámara

```typescript
// Cámara cenital con ángulo para ver toda la arena
camera.position.set(0, 35, 35);
camera.lookAt(0, 0, 0);
camera.fov = 60; // Campo de visión más amplio
```

## 🎮 Modos de Juego

### Modo 1: Free For All
- 4 jugadores independientes
- El primero en llegar a 10 puntos gana
- Cada gol suma 1 punto a todos excepto al que perdió

### Modo 2: Equipos (2v2)
- Jugadores 1 y 3 vs Jugadores 2 y 4
- Puntuación por equipo
- Primer equipo en 15 puntos gana

### Modo 3: Eliminación
- Cada jugador tiene 3 vidas
- Al recibir un gol pierdes una vida
- Último jugador en pie gana

## 🔊 Efectos de Sonido

```typescript
const sounds = {
  paddleHit: new Audio('/sounds/paddle-hit.mp3'),
  wallBounce: new Audio('/sounds/wall-bounce.mp3'),
  goal: new Audio('/sounds/goal.mp3'),
  gameOver: new Audio('/sounds/game-over.mp3'),
};
```

## 🎯 Mecánicas Adicionales

### Power-ups (Opcional)
- **Bola rápida**: Aumenta velocidad temporalmente
- **Pala grande**: Aumenta tamaño de pala
- **Escudo**: Rebota la bola automáticamente
- **Multi-bola**: Añade bolas adicionales

### Dificultad Adaptativa
```typescript
const increaseDifficulty = (ball: GameState['ball'], round: number) => {
  ball.speed = 2 + (round * 0.5); // Incrementa velocidad por ronda
};
```

## 📊 HUD (Interfaz)

```
┌───────────────────────────────────────┐
│  P3: 5    RONDA: 2    TIEMPO: 1:45   │
├─────────┬─────────────────┬───────────┤
│ P4: 3   │                 │    P2: 7  │
│         │     ARENA       │           │
│         │                 │           │
├─────────┴─────────────────┴───────────┤
│              P1: 4                    │
└───────────────────────────────────────┘
```

## 🚀 Optimizaciones

1. **Física simplificada**: Sin gravedad real, solo en plano XZ
2. **Colisiones AABB**: Más rápidas que físicas complejas
3. **Límites de velocidad**: Evitar que la bola se vuelva incontrolable
4. **Interpolación de movimiento**: Suavizar movimiento de palas
5. **Throttle de actualizaciones**: 60 FPS máximo

## 🎨 Mejoras Visuales

```typescript
// Rastro de la bola
const ballTrail = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xffd166, opacity: 0.5, transparent: true })
);

// Partículas al impactar
const createImpactParticles = (position: THREE.Vector3) => {
  // Crear sistema de partículas temporal
};

// Sombras dinámicas
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

## 📝 Notas de Implementación

1. **Comenzar simple**: Mesa + 4 palas + bola
2. **Añadir física básica**: Movimiento y rebotes
3. **Implementar controles**: Un jugador a la vez
4. **Sistema de puntuación**: Detección de goles
5. **Colisiones refinadas**: Efecto spin
6. **UI y feedback**: HUD, sonidos, efectos visuales
7. **Modos de juego**: Variaciones
8. **Testing multiplayer**: Probar con 4 personas reales

## 🔗 Referencias del Proyecto CrashBall

- Sistema de colisiones: `PlaneCollider` y `SphereCollider`
- Física de rebote: Ver `Ball.cpp`
- Control de jugadores: Ver `Player.cpp`
- Iluminación dinámica: `PointLight` siguiendo jugadores
- Materiales: `Material.cpp` con diferentes colores por jugador
