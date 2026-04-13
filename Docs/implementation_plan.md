# Aplicación Web Pong Multijugador - Plan de Implementación

## Descripción del Objetivo
Crear un videojuego Pong multijugador con React (frontend), Fastify (backend WebSocket + API REST) y PostgreSQL (Base de datos). Todos los servicios estarán dockerizados y orquestados mediante Docker Compose. El sistema soportará inicialmente 2 jugadores (preparado para escalar a 4), incluirá gestión de usuarios con autenticación segura, validación de formularios, HTTPS en el backend, y cumplirá con requisitos de documentación como "Política de Privacidad", "Términos de Servicio" y un `README.md` exhaustivo. Será **multilenguaje** (Español / Inglés). Como hito final (Bonus), el juego se actualizará a un entorno visual 3D.

## Decisiones Tecnológicas Confirmadas
1. **Frontend Tooling:** React + Vite (para máxima velocidad y modernidad en SPA).
2. **Base de Datos ORM:** Prisma (por su fuerte tipado TypeScript y facilidad de uso con PostgreSQL).
3. **Estilos y Estética:** CSS Puro (Vanilla CSS), buscando un diseño "premium", dinámico y con animaciones modernas.
4. **Renderizado del Juego:** Inicialmente 2D (HTML Canvas/DOM), con un hito final (Bonus) planificado para migrar la visualización a 3D (ej. React Three Fiber / Three.js).

## Cambios Propuestos

### Estructura de Directorios Raíz
- `docker-compose.yml`: Orquestador de contenedores (Front, Back, DB).
- `README.md`: Documentación principal del proyecto.
- `.env.example`: Plantilla para las variables de entorno.

***

### Componente Frontend (React + Vite)
Directorio: `frontend/`
- `Dockerfile`: Para construir y servir la imagen con Nginx (o servidor de desarrollo inicial).
- `src/game/`: Contendrá las clases documentadas y el Game Loop (`Player.ts`, `Ball.ts`, `Board.ts`, `GameEngine.ts`). Más adelante en el Hito 7, aquí se incorporarán los componentes de renderizado 3D.
- `src/components/`: Componentes de UI reutilizables (Botones, Formularios de Login/Registro).
- `src/pages/`: Vistas de Políticas de Privacidad y Términos de Servicio.
- `src/styles/`: Vanilla CSS con diseño estético premium, animaciones dinámicas.
- `src/i18n.ts`: Configuración de internacionalización (i18next) para traducir la app entre Inglés y Español.

***

### Componente Backend (Fastify)
Directorio: `backend/`
- `Dockerfile`: Contenedor Node.js para ejecutar Fastify.
- `src/server.ts`: Punto de entrada. Configuración HTTPS y plugins de Fastify.
- `src/game/`: Motor lógico autoritativo. Simulaciones de físicas validadas por el servidor para evitar trampas.
- `src/sockets/`: Integración de `@fastify/websocket` para emitir y recibir los movimientos en tiempo real.
- `src/routes/`: Endpoints API REST para registro de usuarios y login seguro (contraseñas hasheadas y JWT).
- `.env`: Credenciales, variables de entorno locales (NO expuestas al cliente) y secretos JWT.

***

### Componente Base de Datos (PostgreSQL)
Directorio/Servicio en Docker: `db/`
- Imagen oficial `postgres:15` (o superior).
- `init.sql`: (Opcional) Script de inicialización, la base de datos principal se estructurará mediante Prisma Migrate.
- Modelos básicos: `User` (email, password hash, fecha de creación), `Match` (historial de partidas).

## Plan de Verificación

### Pruebas Automatizadas
- Tests unitarios para las clases puras de la lógica del juego (calcular vectores, colisiones con paleta/pared).

### Verificación Manual
- **Hito 1 (Front):** Lanzar servidor dev de Vite, ver el canvas en un navegador y testear las funciones del jugador contra la pared.
- **Hito 4 (Integración del juego):** Levantar `docker-compose up`, conectar dos clientes distintos desde Chrome (o modo incógnito) y verificar la latencia de WebSocket y la sincronización correcta entre ambos jugadores y la pelota.
- **Hito 5 (Gestión Usuarios):** Probar el flujo completo de Registro y Login en Chrome, validando UI y HTTPS.
- **Hito 7 (Bonus 3D):** Verificar el rendimiento del modo 3D en Chrome manteniendo 60 FPS fluídos.
