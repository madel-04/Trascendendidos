# Frontend Module

Frontend principal de Trascendendidos.

Para documentacion general, arquitectura y arranque completo del proyecto, revisa el README de la raiz:

- ../README.md

## Stack

- React + TypeScript
- Vite
- React Router
- Three.js (base visual del juego)

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Integracion con backend

El frontend usa `VITE_API_BASE` para consumir la API.

Valor esperado en local:

```bash
VITE_API_BASE=http://localhost:3000
```

## Flujo actual relevante

- Login/Register
- Ruta protegida
- Perfil de usuario con:
  - edicion de datos personales
  - subida de avatar por archivo
  - eliminacion de avatar
  - pestaña de seguridad con 2FA
