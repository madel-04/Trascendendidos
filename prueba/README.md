*This project has been created as part of the 42 curriculum by <madel-va>, <login2>, <login3>[...].*

# Trascendendidos

## Description

**Trascendendidos** is a web application developed as part of the 42 curriculum.  
Its goal is to provide a real-time multiplayer 3D pong game with user authentication, chat, and ranking system based on Crashball | Crash Bandicoot.  
Key features include:
- Real-time gameplay using WebSockets
- User authentication and profile management
- Chat system
- Leaderboard and ranking
- [...]

## Instructions

### Prerequisites

- **Docker & Docker Compose** (required)
- Git (for cloning the repository)
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Optional: Make (for simplified commands)

**Note:** You don't need Node.js, npm, or PostgreSQL installed locally. Everything runs in Docker containers.

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/madel-04/Trascendendidos.git
   cd Trascendendidos
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   **Important:** Edit `.env` and change `JWT_SECRET` to a random string of at least 32 characters for production:
   ```bash
   # Example: generate a secure random secret
   JWT_SECRET=your-super-secret-random-string-min-32-chars-here
   ```

3. **Build and run the application:**
   
   **Option A - Using Make (recommended):**
   ```bash
   make all
   ```
   
   **Option B - Using Docker Compose directly:**
   ```bash
   docker compose up --build
   ```

4. **Wait for all services to start** (this may take a few minutes on first run)
   - You'll see logs from `db`, `backend`, and `frontend` services
   - Wait until you see "Server listening at http://0.0.0.0:3000"

### Access

Once all services are running:

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3000/api/health](http://localhost:3000/api/health)
- **WebSocket:** ws://localhost:3000/ws

### First Steps

1. Open [http://localhost:5173](http://localhost:5173) in your browser
2. Click **"Register"** to create a new account
3. Fill in:
   - Username (3-50 characters)
   - Email
   - Password (minimum 8 characters)
4. After registration, you'll be automatically logged in
5. Click **"Play"** to start the game

### Enable 2FA (Two-Factor Authentication)

1. Click on your username (top right) to go to your profile
2. In the 2FA section, click **"🔐 Habilitar 2FA"**
3. Scan the QR code with Google Authenticator, Authy, or any TOTP app
4. Enter the 6-digit code to verify
5. Now you'll need the code every time you log in

**For detailed 2FA instructions, see [2FA_GUIDE.md](./2FA_GUIDE.md)**

### Additional Commands

```bash
# Stop all services
make down
# or
docker compose down

# View logs
make logs

# View logs for a specific service
make logs-backend
make logs-frontend
make logs-db

# Restart services
make restart

# Clean up (stop and remove containers + images)
make clean

# Full cleanup (includes database data)
make fclean

# Rebuild from scratch
make re
```

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Socket.IO Documentation](https://socket.io/docs/)
- **AI Usage:**  
  AI was used for: code generation (boilerplate, unit tests), documentation drafts, and troubleshooting specific bugs.

## Team Information

| Name      | Role(s)         | Responsibilities                                   |
|-----------|-----------------|----------------------------------------------------|
| <login1>  | PO, Developer   | Product vision, backend API, database design       |
| <login2>  | PM, Developer   | Project management, frontend, authentication       |
| <login3>  | Tech Lead       | Architecture, code review, deployment              |

## Project Management

- **Organization:**  
  Tasks were distributed via [GitHub Issues/Trello/Notion].  
  Weekly meetings for planning and daily standups for progress tracking.
- **Tools:**  
  - Project management: [GitHub Projects, Trello, ...]
  - Communication: [Discord, Slack, ...]
  - Version control: GitHub

## Technical Stack

- **Frontend:** 
  - React 18.3 (UI library)
  - TypeScript (type safety)
  - Vite 5.4 (build tool with HMR)
  - React Router 6.26 (client-side routing)
  - Three.js 0.183 (3D graphics for game)
  
- **Backend:** 
  - Fastify 4.28 (fast web framework)
  - TypeScript (type safety)
  - @fastify/jwt (JWT authentication)
  - @fastify/websocket (real-time communication)
  - PostgreSQL driver (pg)
  - Speakeasy (2FA/TOTP implementation)
  - Zod (schema validation)
  
- **Database:** 
  - PostgreSQL 16 (chosen for ACID compliance, reliability, and excellent support for relational data)
  
- **Infrastructure:**
  - Docker & Docker Compose (containerization)
  - Node.js 20 Alpine (lightweight runtime)
  
- **Security:**
  - PBKDF2 password hashing with salt (100,000 iterations)
  - JWT tokens for stateless authentication
  - 2FA/TOTP support with QR code generation
  - CORS protection
  - Environment variable secrets
  
- **Justification:**  
  Chosen for scalability, maintainability, real-time capabilities, and strong security practices. TypeScript provides type safety across the stack, while Docker ensures consistent environments.

## Database Schema

**Tables:**

### `users`
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  two_fa_secret VARCHAR(255),
  two_fa_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `idx_users_email` on `email` (for fast login lookups)
- `idx_users_username` on `username` (for profile searches)

**Relationships:**
- User authentication uses salted PBKDF2 hashes (100,000 iterations)
- 2FA secrets stored encrypted for TOTP authentication
- Future: `games` table will reference `users.id` for match history
- Future: `messages` table will reference `users.id` for chat system

## Features List

| Feature            | Description                              | Responsible(s)   |
|--------------------|------------------------------------------|------------------|
| User Auth          | Register/login with email/password, JWT tokens | <login1>         |
| 2FA Authentication | Two-factor authentication with TOTP      | <login1>         |
| Protected Routes   | Route protection requiring authentication | <login2>         |
| Real-time Game     | 3D Pong game via WebSockets              | <login1>, <login3>|
| Leaderboard        | Ranking based on game results            | <login1>         |

## Modules

| Module Name         | Type   | Points | Justification & Implementation | Responsible(s) |
|---------------------|--------|--------|-------------------------------|----------------|
| User Authentication | Major  | 2      | Essential for user security   | <login2>       |
| Real-time Game      | Major  | 2      | Core gameplay                 | <login1>, <login3>|
| Chat                | Minor  | 1      | Enhances user interaction     | <login2>       |
| Leaderboard         | Minor  | 1      | Competitive aspect            | <login1>       |
| [Custom Module]     | [Type] | [Pts]  | [Justification]               | [Who]          |

**Total Points:** X

## Individual Contributions

- **<login1>:**  
  Designed and implemented the backend API, database schema, and leaderboard. Overcame challenges with real-time synchronization and database migrations.
- **<login2>:**  
  Developed the authentication system, frontend UI, and chat module. Solved issues with OAuth integration and responsive design.
- **<login3>:**  
  Led technical decisions, set up CI/CD, and managed deployment. Addressed deployment bugs and optimized Docker setup.

____
IMPORTAR MODELO AL THREE
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const loader = new GLTFLoader();
loader.load('/models/kart.glb', (gltf) => {
  const kart = gltf.scene;
  kart.scale.set(0.5, 0.5, 0.5); // Ajustar tamaño
  scene.add(kart);
});


https://sketchfab.com/3d-models/crash-bash-290c9cf2ef4c40f4bd3773482958d7ff
https://sketchfab.com/3d-models/crash-bash-crash-ball-car-remake-8ed73ebbc24e4463a79cc9ed68a4cd17

0O