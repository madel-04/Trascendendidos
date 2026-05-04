# OAuth Setup Guide - Configuración OAuth Local

Para que el login OAuth funcione completamente, necesitas registrar aplicaciones en Google, GitHub y 42 Intra y obtener credenciales reales.

## 🔐 Google OAuth Setup

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto (o usa uno existente)
3. Habilita la API de Google+ o Google Identity:
   - En "APIs & Services" → "Library"
   - Busca "Google+ API" o "Google Identity" y da click en "Enable"
4. Ve a "APIs & Services" → "Credentials"
5. Haz click en "Create Credentials" → "OAuth client ID"
6. Selecciona "Web application"
7. Llena los campos:
   - **Name**: Transcendence OAuth
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - **Authorized redirect URIs**:
     ```
     http://localhost:3000/api/auth/oauth/google/callback
     ```
8. Copia el `Client ID` y `Client Secret`
9. Actualiza en `.env`:
   ```
   GOOGLE_CLIENT_ID=tu-client-id-aqui
   GOOGLE_CLIENT_SECRET=tu-client-secret-aqui
   ```

## 🐙 GitHub OAuth Setup

1. Ve a [GitHub Settings → Developer Settings → OAuth Apps](https://github.com/settings/developers)
2. Haz click en "New OAuth App"
3. Llena los campos:
   - **Application name**: Transcendence Pong
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**:
     ```
     http://localhost:3000/api/auth/oauth/github/callback
     ```
4. Copia el `Client ID` y genera un nuevo `Client Secret`
5. Actualiza en `.env`:
   ```
   GITHUB_CLIENT_ID=tu-client-id-aqui
   GITHUB_CLIENT_SECRET=tu-client-secret-aqui
   ```

## 🎓 42 Intra OAuth Setup

1. Ve a [42 Intra API](https://profile.intra.42.fr/oauth/applications)
2. Crea una nueva aplicación OAuth
3. Llena los campos:
   - **Name**: Transcendence Pong
   - **Redirect URIs**:
     ```
     http://localhost:3000/api/auth/oauth/42/callback
     ```
4. Copia el `UID` (Client ID) y `Secret` (Client Secret)
5. Actualiza en `.env`:
   ```
   FORTYTWO_CLIENT_ID=tu-uid-aqui
   FORTYTWO_CLIENT_SECRET=tu-secret-aqui
   ```

## 🚀 Aplicar cambios

Una vez actualizado `.env`, reinicia los contenedores:

```bash
cd /home/may/trabajos/trascendence/Trascendendidos
docker compose down
docker compose up --build -d
```

Luego visita http://localhost:5173/login y deberías ver los botones de OAuth funcionales.

## ✅ Testing rápido

1. Navega a http://localhost:5173/login
2. Haz click en un botón OAuth
3. Serás redirigido al proveedor
4. Después de autorizar, deberías ser redirigido a http://localhost:5173/oauth/callback y logearte automáticamente

## 📝 Notas

- Para **producción**, actualiza `PUBLIC_BACKEND_URL` en `.env` para que apunte a tu dominio real
- Todos los redirect URIs deben coincidir exactamente con lo registrado en el proveedor
- Los `Client Secret` NUNCA deben ser compartidos públicamente (commitear .env en git es un riesgo de seguridad)
