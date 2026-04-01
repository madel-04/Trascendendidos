# Changelog - Trascendence Pong Fullstack

## Resumen General

Este documento detalla todos los cambios realizados en el proyecto Trascendence Pong desde la consolidación de arquitectura hasta la implementación completa de autenticación, seguridad, social realtime y sistema de invitaciones de partida.

---

## Phase 1: Consolidación Arquitectónica

### Objetivo
Unificar la arquitectura fragmentada (`prueba/` vs raíz) en una única estructura estándar y eliminar código duplicado.

### Cambios
- ✅ **Migración con raíz**: Promovimos stack maduro de `prueba/` a `backend/` y `frontend/` en la raíz.
- ✅ **Eliminación de duplicidad**: Removimos carpeta `prueba/` completamente.
- ✅ **Actualización de documentación**: `README.md` y `frontend/README.md` reflejan arquitectura actual.

### Resultado
- Codebase único y canónico.
- Ambiente Docker consistente (`db`, `backend`, `frontend`).
- Builds limpios sin conflictos.

---

## Phase 2: Autenticación, 2FA y Gestión de Perfil

### Objetivo
Implementar autenticación robusta con JWT, autenticación de dos factores y gestión segura de perfiles de usuario.

### Backend (`backend/src/routes/auth.ts`)

#### Autenticación Base
- **`POST /api/auth/register`**: Registro con email/username/password + validaciones.
- **`POST /api/auth/login`**: Login con JWT token + validación de credenciales.
- **`GET /api/auth/me`**: Obtener perfil autenticado del usuario actual.

#### Two-Factor Authentication (2FA)
- **`POST /api/auth/2fa/setup`**: Generar QR code (Speakeasy TOTP).
- **`POST /api/auth/2fa/verify`**: Verificar token TOTP y habilitar 2FA.
- **`POST /api/auth/2fa/disable`**: Deshabilitar 2FA con verificación de contraseña.

#### Gestión de Perfil
- **`PATCH /api/auth/profile`**: Actualizar display_name, bio.
- **`POST /api/auth/avatar`**: Upload seguro de avatar (multipart).
  - Normalización con Sharp (redimensionar a 400x400, JPG, 85% quality).
  - Almacenamiento en `/public/uploads/`.
  - URL servida en `/public/uploads/{filename}`.
- **`DELETE /api/auth/avatar`**: Eliminar avatar del usuario.
- **`POST /api/auth/password`**: Cambiar contraseña (verifica anterior).

#### Seguridad de Contraseña
- **Política fuerte**: 12+ caracteres, mayúscula, minúscula, número, símbolo, sin espacios.
- **Validación backend**: Rechaza contraseñas comunes (bcrypt hashed compare contra lista).
- **Validación frontend**: Medidor de fortaleza en Register/Profile.
- **Rate limiting**: Endpoints sensibles (login, 2FA) con rate limits configurables.

### Frontend (`frontend/src/`)

#### Componentes de Auth
- **`pages/Login.tsx`**: UI de login con validación de formato.
- **`pages/Register.tsx`**: Registro con medidor de fortaleza de contraseña en tiempo real.
- **`pages/Profile.tsx`**: Visualización y edición de perfil, avatar upload/delete, cambio de contraseña.
- **`components/ProtectedRoute.tsx`**: Wrapper para rutas que requieren autenticación.
- **`context/AuthContext.tsx`**: Context global con token, usuario, login/logout/register.

#### Medidor de Fortaleza
- **`utils/passwordStrength.ts`**: Función `evaluatePassword()` que devuelve:
  - `score` (0-100): Intensidad numérica.
  - `level` ("weak" | "fair" | "good" | "strong"): Clasificación.
  - `checklist`: Array de reglas cumplidas/incumplidas con descripción.
- Mostrado en Register y en tab de seguridad de Profile.

### Base de Datos (`backend/src/db.ts`)

#### Tabla `users`
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(80),
  bio VARCHAR(280),
  avatar_url VARCHAR(2048),
  two_fa_secret VARCHAR(255),
  two_fa_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Testing
- E2E scripts validaban:
  - Registro con validaciones.
  - Login y generación de JWT.
  - 2FA setup/verify/disable.
  - Avatar upload/normalize/delete.
  - Password change con restricciones.

---

## Phase 3: Sistema Social (Amigos y Bloqueos)

### Objetivo
Implementar amistad bidireccional, bloqueos y notificaciones sociales en tiempo real.

### Backend (`backend/src/routes/social.ts`)

#### Endpoints
- **`GET /api/social/overview`**: Resumen de amigos, solicitudes, bloqueados.
- **`POST /api/social/friend-request`**: Enviar solicitud de amistad.
- **`POST /api/social/friend-request/:requestId/accept`**: Aceptar solicitud (crea amigos bidireccionales).
- **`POST /api/social/friend-request/:requestId/reject`**: Rechazar solicitud.
- **`POST /api/social/block`**: Bloquear usuario.
- **`POST /api/social/unblock`**: Desbloquear usuario.

#### Lógica
- Validaciones de amistad/bloqueos antes de operaciones.
- Notificaciones realtime por usuario con decorator `notifySocialUser()`.
- Eventos emitidos: `friend_request_received`, `friend_request_accepted`, `user_blocked_you`, etc.

### Base de Datos

#### Tabla `friend_requests`
```sql
CREATE TABLE friend_requests (
  id SERIAL PRIMARY KEY,
  sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);
```

#### Tabla `friends`
```sql
CREATE TABLE friends (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);
```

#### Tabla `blocks`
```sql
CREATE TABLE blocks (
  blocker_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);
```

### Frontend (`frontend/src/components/SocialPanel.tsx`)

#### Funcionalidades
- Listado de amigos con opción de bloquear.
- Solicitudes recibidas/enviadas con aceptar/rechazar.
- Bloqueados con opción de desbloquear.
- Refrescado automático en eventos realtime.

---

## Phase 4: WebSocket Autenticado y Notificaciones Realtime

### Objetivo
Establecer canal bidireccional para notificaciones sociales en tiempo real.

### Backend (`backend/src/server.ts`)

#### WebSocket Autenticado
- **`GET /ws?token=<JWT>`**: Conexión WebSocket autenticada con JWT.
- Valida token en handshake.
- Mantiene mapa `userId -> Set<sockets>` para notificaciones dirigidas.

#### Decorator `notifySocialUser()`
```typescript
app.notifySocialUser(userId: number, event: SocialRealtimeEvent, data?: Record<string, unknown>)
```
- Emite evento a todos los sockets del usuario.
- Formato: `{ channel: "social", event: "...", data: {...} }`

#### Eventos Soportados
```typescript
type SocialRealtimeEvent =
  | "friend_request_received"
  | "friend_request_sent"
  | "friend_request_accepted"
  | "friend_request_rejected"
  | "user_blocked_you"
  | "user_unblocked_you"
  | "you_blocked_user"
  | "you_unblocked_user"
  | "chat_message_received"
  | "match_invite_received"
  | "match_invite_sent"
  | "match_invite_accepted"
  | "match_invite_rejected";
```

### Frontend

#### Global notification Bell (`App.tsx`)
- Escucha eventos `/ws` socket.
- Renderiza campana "🔔" con contador.
- Abre panel flotante de notificaciones.

#### SocialPanel WebSocket Integration
- Refrescado automático de `overview` y `invites` en eventos.
- Notificaciones locales con timestamp y auto-cleanup.

---

## Phase 5: Rediseño UI/UX y Legal Pages

### Objetivo
Crear interfaz visual coherente con tema, colores y páginas legales completas.

### Global Styling (`frontend/src/index.css`)

#### Tema & Colores
```css
--color-bg-primary: #ffffff
--color-bg-secondary: #f9f9f9
--color-text-primary: #111111
--color-text-secondary: #666666
--color-border: #dddddd
--color-accent: #111111 (negro)
--color-success: #2ecc71
--color-error: #e74c3c
--color-warn: #f39c12
```

#### Componentes
- Tarjetas (cards) con border/shadow sutil.
- Formularios con inputs/buttons estándar.
- Medidor de fortaleza de contraseña (barrita + colores).
- Panel de notificaciones (lista deslizable máx 30 items).

### Layout Principal (`App.tsx`)

```
┌─────────────────────────────────────┐
│ Header (Topbar + Logo + Nav + Bell) │
├─────────────────────────────────────┤
│                                     │
│         Router Outlet (Pages)       │
│                                     │
├─────────────────────────────────────┤
│ Footer (Links Privacy/Terms)        │
└─────────────────────────────────────┘
```

#### Topbar
- Logo/Brand.
- Navegación: Home, Profile, Social.
- Campana notificaciones realtime.
- Logout.

#### Footer
- Links a Privacy y Terms (abiertos en modal/página).
- Copyright.

### Páginas Legales

#### `pages/Privacy.tsx`
Contenido completo de privacidad:
- Recopilación de datos.
- Uso de datos.
- Seguridad.
- Derechos de usuarios.
- Cookies.

#### `pages/Terms.tsx`
Términos de servicio:
- Aceptación de términos.
- Licencia de uso.
- Prohibiciones.
- Limitación de responsabilidad.
- Cambios en términos.

### Unificación Visual
- Login/Register/Profile con estilos consistentes.
- Inputs/buttons con padding/border estandarizados.
- Colores y tipografía uniformes.

---

## Phase 6: Seguridad de Contraseñas

### Objetivo
Implementar política fuerte de contraseña con validación frontend y backend.

### Backend Policy

```typescript
const PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
  noSpaces: true,
  commonPasswords: [...list of 1000+ common passwords...],
  cannotContain: [email, username],
};
```

### Validación

#### Cadena `Zod`
```typescript
const PasswordSchema = z.string()
  .min(12, "Mínimo 12 caracteres")
  .refine(pwd => /[A-Z]/.test(pwd), "Debe contener mayúsculas")
  .refine(pwd => /[a-z]/.test(pwd), "Debe contener minúsculas")
  .refine(pwd => /\d/.test(pwd), "Debe contener números")
  .refine(pwd => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd), "Debe contener símbolos")
  ...
```

#### Medidor Frontend (`passwordStrength.ts`)
- Scores: 0-25 (weak), 25-50 (fair), 50-75 (good), 75-100 (strong).
- Checklist de reglas cumplidas/incumplidas.
- Usado en Register/Profile.

---

## Phase 7: Chat Realtime y Mensajería Directa

### Objetivo
Implementar chat bidireccional entre amigos con notificaciones realtime.

### Backend (`backend/src/routes/chat.ts`)

#### Endpoints
- **`GET /api/chat/conversations`**: Listar conversaciones (amigos con mensajes).
- **`GET /api/chat/conversation/:username/messages?limit=80`**: Cargar historial de chat.
- **`POST /api/chat/conversation/:username/messages`**: Enviar mensaje.
  - Valida que son amigos y no están bloqueados.
  - Emite evento `chat_message_received` al destinatario.

### Base de Datos

#### Tabla `direct_messages`
```sql
CREATE TABLE direct_messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (sender_id <> receiver_id)
);
```

### Frontend Integration (`SocialPanel.tsx`)

#### UI
- Lista de amigos como pestañas clickeables.
- Vista de conversación con historial scrolleable.
- Input para enviar mensaje.
- Auto-refresh en evento `chat_message_received` del WS.

#### Flujo
1. Click en amigo.
2. Carga historial vía GET `/api/chat/conversation/:username/messages`.
3. User escribe + Send.
4. POST al backend + actualiza local.
5. Otros usuarios reciben notificación realtime.

---

## Phase 8: Invitaciones de Partida y Matchmaking

### Objetivo
Sistema para invitar a amigos a nuevas partidas con confirmación y auto-join.

### Backend (`backend/src/routes/match.ts`)

#### Endpoints
- **`GET /api/match/invites`**: Listar invitaciones entrantes/salientes.
- **`POST /api/match/invite`**: Enviar invitación a amigo.
  - Valida que son amigos.
  - Valida sin bloqueos.
- **`POST /api/match/invite/:inviteId/accept`**: Aceptar invitación.
  - Genera `roomId` único (`room-{inviteId}-{timestamp}`).
  - Devuelve `roomId` + `opponentUsername`.
  - Emite evento a ambos usuarios.
- **`POST /api/match/invite/:inviteId/reject`**: Rechazar invitación.

### Base de Datos

#### Tabla `match_invites`
```sql
CREATE TABLE match_invites (
  id BIGSERIAL PRIMARY KEY,
  sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_room_id VARCHAR(128),  -- Generado al aceptar
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (sender_id <> receiver_id)
);
```

### Frontend Integration

#### SocialPanel (`SocialPanel.tsx`)
- UI: Invitaciones recibidas/enviadas.
- Botones: Aceptar/Rechazar.
- **Al aceptar**:
  - Obtiene `roomId` + `opponentUsername` de respuesta.
  - Navega automáticamente a `/play?roomId=...&opponent=...&source=invite`.

#### Play Page (`pages/Play.tsx`)
- Llee query params con `useSearchParams()`.
- Si `source === "invite"`:
  - Renderiza banner: "Partida por invitación lista".
  - Muestra `roomId` y `opponentUsername`.
  - Canvas 3D lista para iniciar con contexto de rival.

### Flujo Completo
```
User A invita a User B
    ↓
User B recibe notificación realtime
    ↓
User B click "Aceptar" en SocialPanel
    ↓
Backend genera roomId y devuelve opponentUsername
    ↓
Frontend navega automáticamente a /play con parámetros
    ↓
Play page muestra contexto y está lista para juego
    ↓
Canvas 3D con rival designado
```

---

## Phase 9: Validaciones y Robustez

### Backend Validaciones

#### Database
- **Retry connection**: 10 intentos con 2s delay entre ellos.
- **Índices**: Para queries frecuentes (user lookup, social status, message history).
- **Constraints**: Foreign keys, unique constraints, check constraints.

#### Route Validations
- **Zod schemas**: Todas las rutas usan Zod para validar body/params.
- **Auth checks**: Todas las rutas privadas requieren `onRequest: [app.authenticate]`.
- **Business logic checks**: Validar amistad antes de operaciones, no bloqueo activo, etc.

### Frontend Validations

#### Input Validation
- **Email**: Formato básico.
- **Username**: 3-50 caracteres, alphanumério/underscore/dash.
- **Password**: Reglas de complejidad via `passwordStrength.ts`.
- **Messages**: Trim + min length 1.

#### Error Handling
- Catch-blocks en todos los fetch calls.
- User-facing error messages.
- Silent fallbacks en operaciones secundarias (chat refresh).

### Testing
- E2E scripts para validar flujos completos.
- Docker compose para ambiente real.
- Builds TypeScript sin errores.

---

## Arquitectura Técnica Final

```
TRASCENDENCE/
├── docker-compose.yml (3 servicios: db, backend, frontend)
├── Makefile (tareas comunes)
│
├── backend/
│   ├── src/
│   │   ├── server.ts (bootstrap Fastify, rutas, WS)
│   │   ├── db.ts (schema PostgreSQL, retry logic)
│   │   ├── env.ts (env vars)
│   │   ├── types/
│   │   │   └── fastify.d.ts (tipos de eventos realtime)
│   │   └── routes/
│   │       ├── auth.ts (registro, login, 2FA, perfil, avatar, password)
│   │       ├── health.ts (health check)
│   │       ├── social.ts (amigos, bloqueos)
│   │       ├── chat.ts (mensajería directa)
│   │       └── match.ts (invitaciones de partida)
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx (entry point, import CSS global)
│   │   ├── App.tsx (layout shell, router, topbar, footer, campana)
│   │   ├── App.css (estilos misc)
│   │   ├── index.css (tema global, componentes, medidor password, notifs)
│   │   ├── i18n.ts (multi-idioma stub)
│   │   ├── context/
│   │   │   └── AuthContext.tsx (token, usuario, login/logout)
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── Play.tsx (canvas + contexto invitación)
│   │   │   ├── Privacy.tsx
│   │   │   └── Terms.tsx
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── SocialPanel.tsx (social, chat, invites, todo realtime)
│   │   │   ├── LanguageSwitcher.tsx
│   │   │   ├── MainMenu.tsx
│   │   │   ├── GameView.tsx
│   │   │   └── PongCanvas.tsx
│   │   ├── game/ (lógica pong)
│   │   │   ├── GameEngine.ts
│   │   │   ├── Player.ts
│   │   │   ├── Board.ts
│   │   │   └── Ball.ts
│   │   ├── three/
│   │   │   └── ThreeCanvas.tsx (canvas 3D con Three.js)
│   │   ├── assets/
│   │   └── utils/
│   │       └── passwordStrength.ts
│   ├── tsconfig.json, tsconfig.app.json, tsconfig.node.json
│   ├── vite.config.ts
│   ├── eslint.config.js
│   └── package.json
│
└── README.md (documentación proyecto)
```

---

## Stack Tecnológico

### Backend
- **Runtime**: Node.js
- **Framework**: Fastify
- **DB**: PostgreSQL (pg)
- **Validation**: Zod
- **Auth**: JWT (jsonwebtoken)
- **2FA**: Speakeasy (TOTP), QRCode
- **Images**: Sharp (avatar processing)
- **WebSocket**: @fastify/websocket
- **Multipart**: @fastify/multipart
- **Static**: @fastify/static

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Routing**: React Router v6
- **HTTP**: Fetch API (nativo)
- **3D**: Three.js (canvas pong)
- **Linter**: ESLint

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Environment**: WSL2 Ubuntu
- **Ports**: 
  - Frontend: 5173
  - Backend: 3000
  - PostgreSQL: 5432

---

## Cambios por Archivo (Resumen)

### Backend

| Archivo | Cambios |
|---------|---------|
| `src/server.ts` | WS autenticado, decorator notifySocialUser, registro rutas |
| `src/db.ts` | Schema: users, friend_requests, friends, blocks, direct_messages, match_invites |
| `src/types/fastify.d.ts` | Tipos eventos realtime |
| `src/routes/auth.ts` | Registro, login, 2FA setup/verify/disable, profile, avatar, password change |
| `src/routes/health.ts` | Health check (sin cambios) |
| `src/routes/social.ts` | Friend requests, blocks, realtime notifications |
| `src/routes/chat.ts` | (NUEVO) Conversaciones, mensajería, realtime |
| `src/routes/match.ts` | (NUEVO) Invitaciones partida, roomId generation, auto-navigate |

### Frontend

| Archivo | Cambios |
|---------|---------|
| `src/main.tsx` | Import CSS global (fix UI blanca) |
| `src/App.tsx` | Layout shell, router, topbar, footer, campana notificaciones |
| `src/App.css` | Estilos misc |
| `src/index.css` | Tema global, componentes, medidor password, panel notificaciones |
| `src/context/AuthContext.tsx` | Token, usuario, login/logout, register |
| `src/pages/Login.tsx` | Formulario login unificado |
| `src/pages/Register.tsx` | Formulario signup + medidor fortaleza |
| `src/pages/Profile.tsx` | Edición perfil, avatar, password change |
| `src/pages/Play.tsx` | Canvas + lectura roomId/opponent de query params |
| `src/pages/Privacy.tsx` | (NUEVO) Página privacidad completa |
| `src/pages/Terms.tsx` | (NUEVO) Página términos completa |
| `src/components/ProtectedRoute.tsx` | Validación auth (sin cambios) |
| `src/components/SocialPanel.tsx` | Amigos, bloqueos, solicitudes, **chat**, **invites**, notificaciones locales, WS |
| `src/utils/passwordStrength.ts` | (NUEVO) Evaluación fortaleza + checklist |

---

## Testing & Validación

Todos los cambios fueron validados con:

1. **Build TypeScript**: `npm run build` (backend/frontend).
2. **Docker Compose**: Servicios corriendo y comunicándose.
3. **E2E Scripts**: 
   - Registro → Login → 2FA setup.
   - Avatar upload/normalize/delete.
   - Friend requests → accept/reject.
   - Block/unblock.
   - Chat mensajería bidireccional.
   - Match invite → accept con roomId + opponent.
4. **Manual QA**: Flujos UI en navegador.

---

## Próximos Pasos Sugeridos

1. **Integración Gameplay**: Usar `roomId` + `opponent` para:
   - Reservar sala en servidor.
   - Sincronizar inicio canvas 3D.
   - Notificar a ambos usuarios cuando estén listos.

2. **Persistencia Notificaciones**: 
   - Historial de notificaciones en DB.
   - "Unread" counters.

3. **Ranking/Stats**: 
   - Tabla de victorias/derrotas.
   - Elo rating.

4. **Optimizaciones**:
   - Code-splitting Vite.
   - Caching avatares.
   - Compresión mensajes.

5. **Tests Automáticos**: 
   - Jest/Vitest para lógica crítica.
   - E2E con Playwright/Cypress.

---

**Última actualización**: 31 de Marzo, 2026  
**Estado**: ✅ Completado - Stack fullstack funcional con auth, social realtime, chat y matchmaking.
