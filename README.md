# Trascendendidos

Aplicacion web para el proyecto de Pong multijugador con autenticacion, perfil de usuario y seguridad reforzada.

## Arquitectura actual

La arquitectura activa del proyecto esta en la raiz:

- backend/: API Fastify + PostgreSQL + JWT + 2FA + perfil seguro
- frontend/: React + Vite + rutas protegidas
- docker-compose.yml: orquestacion de db, backend y frontend
- Makefile: comandos de ciclo de desarrollo

## Funcionalidades implementadas

- Registro e inicio de sesion con JWT
- 2FA con TOTP (setup, enable, disable)
- Perfil editable (username, nombre visible, bio)
- Avatar seguro:
  - subida de imagen por archivo
  - validacion de tipo y tamano
  - normalizacion server-side a webp 256x256
  - eliminacion de avatar
- Rate limiting en endpoints sensibles de auth y perfil

## Requisitos

- Docker y Docker Compose
- Opcional: Make

## Puesta en marcha

1. Crear .env desde .env.example (si no existe):

```bash
cp .env.example .env
```

2. Levantar servicios:

```bash
docker compose up --build -d
```

O con make:

```bash
make all
```

3. Endpoints principales:

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/api/health

## Comandos utiles

```bash
make up
make down
make logs
make logs-backend
make logs-frontend
make logs-db
```

## Validacion rapida post-cambios

```bash
cd backend && npm run build
cd ../frontend && npm run build
cd .. && docker compose up -d
curl http://localhost:3000/api/health
```

## Notas

- La carpeta de trabajo legacy usada durante la migracion ya no forma parte de la arquitectura activa.
- Si quieres preparar entrega, el siguiente paso recomendado es documentar modulos pendientes (amistades, bloqueo, chat y juego 4 jugadores) sobre esta base de raiz.
