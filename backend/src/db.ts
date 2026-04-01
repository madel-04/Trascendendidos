// ===== CONEXIÓN A LA BASE DE DATOS =====
import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

// Pool de conexiones a PostgreSQL
// Reutiliza conexiones para mejor rendimiento
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const DB_CONNECT_RETRIES = 10;
const DB_RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===== INICIALIZACIÓN DE TABLAS =====
// Crea las tablas si no existen
export async function initDatabase() {
  let client: pg.PoolClient | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt += 1) {
    try {
      client = await pool.connect();
      break;
    } catch (error) {
      lastError = error;
      console.warn(
        `Database connection attempt ${attempt}/${DB_CONNECT_RETRIES} failed. Retrying in ${DB_RETRY_DELAY_MS}ms...`
      );
      if (attempt < DB_CONNECT_RETRIES) {
        await sleep(DB_RETRY_DELAY_MS);
      }
    }
  }

  if (!client) {
    console.error("Database connection failed after retries", lastError);
    throw lastError;
  }
  
  try {
    // Tabla de usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
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
    `);

    // Backward-compatible schema upgrades for existing databases.
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS display_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS bio VARCHAR(280),
      ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(2048);
    `);

    // Índices para mejorar rendimiento
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    // Solicitudes de amistad entre usuarios.
    await client.query(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id SERIAL PRIMARY KEY,
        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(sender_id, receiver_id),
        CHECK (sender_id <> receiver_id)
      );
    `);

    // Relacion de amistad materializada en ambos sentidos.
    await client.query(`
      CREATE TABLE IF NOT EXISTS friends (
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, friend_id),
        CHECK (user_id <> friend_id)
      );
    `);

    // Bloqueos de usuario a usuario.
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        blocker_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (blocker_id, blocked_id),
        CHECK (blocker_id <> blocked_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status
      ON friend_requests(receiver_id, status);
      CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_status
      ON friend_requests(sender_id, status);
      CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
      CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON blocks(blocker_id);
      CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON blocks(blocked_id);
    `);

    // Mensajeria directa entre usuarios amigos.
    await client.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id BIGSERIAL PRIMARY KEY,
        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content VARCHAR(1000) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CHECK (sender_id <> receiver_id)
      );
    `);

    // Invitaciones para nueva partida entre usuarios.
    await client.query(`
      CREATE TABLE IF NOT EXISTS match_invites (
        id BIGSERIAL PRIMARY KEY,
        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_room_id VARCHAR(128),
        status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CHECK (sender_id <> receiver_id)
      );
    `);

    await client.query(`
      ALTER TABLE match_invites
      ADD COLUMN IF NOT EXISTS match_room_id VARCHAR(128);
    `);

    // Salas de juego activas con estado de jugadores.
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_rooms (
        id BIGSERIAL PRIMARY KEY,
        room_id VARCHAR(128) UNIQUE NOT NULL,
        player1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        player2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        player1_ready BOOLEAN DEFAULT FALSE,
        player2_ready BOOLEAN DEFAULT FALSE,
        game_started BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CHECK (player1_id <> player2_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created
      ON direct_messages(sender_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_created
      ON direct_messages(receiver_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_match_invites_receiver_status
      ON match_invites(receiver_id, status);
      CREATE INDEX IF NOT EXISTS idx_match_invites_sender_status
      ON match_invites(sender_id, status);
      CREATE INDEX IF NOT EXISTS idx_match_invites_room
      ON match_invites(match_room_id);
      CREATE INDEX IF NOT EXISTS idx_game_rooms_room_id
      ON game_rooms(room_id);
      CREATE INDEX IF NOT EXISTS idx_game_rooms_players
      ON game_rooms(player1_id, player2_id);
    `);

    console.log("Database tables initialized");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Helper para ejecutar queries de forma segura
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}
