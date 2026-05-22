# Aplicación Web Pong Multijugador - Lista de Tareas

Este documento rastrea el progreso de la implementación del juego Pong Multijugador, dividido en los hitos solicitados.

## Hito 1: Desarrollo del Frontend (React + Vite + Vanilla CSS)
- [x] Configuración inicial del proyecto frontend con Vite + React (TypeScript opcional pero recomendado).
- [x] Diseño de la interfaz de usuario principal (menú, marco del juego) usando Vanilla CSS premium.
- [x] Implementación de la renderización del canvas/DOM para el juego Pong 2D clásico.
- [x] Creación de las clases del juego (Jugador, Pelota, Tablero) con sus respectivos métodos ampliamente documentados y explicados.
- [x] Implementación del bucle de juego básico (game loop) en el cliente.
- [x] Configuración del contenedor Docker para el frontend.
- [x] Soporte multilenguaje (i18n) con selector de idiomas (Español / Inglés).

## Hito 2: Desarrollo del Backend (Fastify)
- [x] Configuración inicial del proyecto backend con Fastify.
- [x] Implementación de WebSockets (@fastify/websocket) para la comunicación en tiempo real.
- [x] Motores de física y lógica del juego (movimiento de la pelota, rebotes, puntuación) validados en el servidor para evitar trampas.
- [x] Sistema de emparejamiento básico (matchmaking para 2 jugadores).
- [x] Preparación de la arquitectura del estado para soportar hasta 4 jugadores en el futuro (ej. mapear posiciones top/bottom/left/right).
- [x] Configuración del contenedor Docker para el backend.

## Hito 3: Base de Datos (PostgreSQL + Prisma) y Docker Compose
- [x] Creación del `docker-compose.yml` integrando Front, Back y Base de Datos.
- [x] Configuración de la imagen oficial de PostgreSQL.
- [x] Diseño inicial del esquema de la base de datos (Usuarios, Partidas, Estadísticas).
- [x] Integración del backend con la base de datos (usando el ORM Prisma).

## Hito 4: Integración y Juego Funcional
- [x] Conectar el frontend React con el servidor WebSocket Fastify.
- [x] Sincronización del estado del juego servidor -> cliente (interpolación de movimiento si es necesario).
- [x] Transmisión de las pulsaciones de teclas/movimientos cliente -> servidor.
- [x] Pruebas cruzadas: asegurar que dos instancias del navegador pueden jugar al unísono.

## Hito 5: Gestión de Usuarios y Seguridad
- [x] Arreglar traducción footer (TRANSCENDENCE_PROJECT)
- [x] Refinar paginación y layout legal (Privacy.tsx y Terms.tsx) - Incluyendo navegación fija al fondo.
- [x] Unificar dimensiones y posición de todos los contenedores principales (Incluyendo Menú - Altura y Ancho corregidos).
- [x] Resolver conflictos de pull branch PRE (App, Profile, index.css, LanguageSwitcher)ación de usuarios vía JWT (JSON Web Tokens) e integración con WebSockets.
- [ ] Interfaz de usuario para login/registro con validación de formularios.
- [ ] Configuración de HTTPS en el backend.
- [ ] Gestión segura de variables de entorno `.env` para credenciales de BBDD y secretos.

## Hito 6: Estética, Requisitos Legales y Documentación Documental
- [ ] Refinamiento del diseño web con estética moderna (diseño premium en Vanilla CSS, animaciones, componentes pulidos).
- [ ] Creación e integración de páginas completas para "Política de Privacidad" y "Términos de Servicio".
- [ ] Elaboración del `README.md` final del proyecto con instrucciones de despliegue, arquitectura y justificación de recursos.

## Hito 7: Bonus - Renderizado 3D
- [ ] Integrar biblioteca 3D (ej. Three.js o React Three Fiber).
- [ ] Adaptar las clases del frontend para renderizar la lógica del juego (ya funcional) en un entorno 3D.
- [ ] Añadir iluminación, materiales premium y animaciones de cámara al juego 3D.
