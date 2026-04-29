// ===== CONEXION A LA BASE DE DATOS =====
import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const DB_CONNECT_RETRIES = 10;
const DB_RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS display_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS bio VARCHAR(280),
      ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(2048);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS oauth_accounts (
        id BIGSERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(32) NOT NULL,
        provider_user_id VARCHAR(255) NOT NULL,
        provider_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(provider, provider_user_id),
        UNIQUE(user_id, provider)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_email
      ON oauth_accounts(provider, provider_email);
    `);

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS friends (
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, friend_id),
        CHECK (user_id <> friend_id)
      );
    `);

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

    await client.query(`
      ALTER TABLE direct_messages
      ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;
    `);

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
      CREATE TABLE IF NOT EXISTS tournaments (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        description VARCHAR(500) NOT NULL DEFAULT '',
        creator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
        max_players INT NOT NULL CHECK (max_players IN (4, 8, 16)),
        champion_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        ended_at TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tournament_participants (
        id BIGSERIAL PRIMARY KEY,
        tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seed INT,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(tournament_id, user_id),
        UNIQUE(tournament_id, seed)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tournament_matches (
        id BIGSERIAL PRIMARY KEY,
        tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        round INT NOT NULL,
        match_order INT NOT NULL,
        player1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        player2_id INT REFERENCES users(id) ON DELETE CASCADE,
        game_room_id VARCHAR(128) UNIQUE,
        winner_id INT REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        UNIQUE(tournament_id, round, match_order),
        CHECK (player2_id IS NULL OR player1_id <> player2_id)
      );
    `);

    await client.query(`
      ALTER TABLE tournaments
      ADD COLUMN IF NOT EXISTS description VARCHAR(500) NOT NULL DEFAULT '';
    `);

    await client.query(`
      ALTER TABLE tournament_matches
      ALTER COLUMN player2_id DROP NOT NULL;
    `);

    await client.query(`
      ALTER TABLE tournament_matches
      ADD COLUMN IF NOT EXISTS game_room_id VARCHAR(128) UNIQUE;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'tournament_matches_player1_id_player2_id_check'
        ) THEN
          ALTER TABLE tournament_matches
          DROP CONSTRAINT tournament_matches_player1_id_player2_id_check;
        END IF;
      END $$;
    `);

    await client.query(`
      ALTER TABLE tournament_matches
      ADD CONSTRAINT tournament_matches_player_distinct_check
      CHECK (player2_id IS NULL OR player1_id <> player2_id);
    `).catch(async (error: any) => {
      if (error?.code !== "42710") throw error;
    });

    await client.query(`
      CREATE TABLE IF NOT EXISTS game_matches (
        id BIGSERIAL PRIMARY KEY,
        room_id VARCHAR(128) UNIQUE NOT NULL,
        player1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        player2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        winner_id INT REFERENCES users(id) ON DELETE SET NULL,
        reason VARCHAR(16) NOT NULL CHECK (reason IN ('forfeit', 'disconnect', 'completed', 'draw')),
        player1_score INT NOT NULL DEFAULT 0,
        player2_score INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        CHECK (player1_id <> player2_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        description VARCHAR(400),
        owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_name_active
      ON organizations (LOWER(name))
      WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_organizations_owner_created
      ON organizations(owner_id, created_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id BIGSERIAL PRIMARY KEY,
        org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(16) NOT NULL DEFAULT 'member',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(org_id, user_id),
        CHECK (role IN ('owner', 'admin', 'member'))
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_join_requests (
        id BIGSERIAL PRIMARY KEY,
        org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(org_id, user_id),
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
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
      CREATE INDEX IF NOT EXISTS idx_game_matches_player1
      ON game_matches(player1_id, ended_at DESC);
      CREATE INDEX IF NOT EXISTS idx_game_matches_player2
      ON game_matches(player2_id, ended_at DESC);
      CREATE INDEX IF NOT EXISTS idx_game_matches_winner
      ON game_matches(winner_id);
      CREATE INDEX IF NOT EXISTS idx_tournaments_status
      ON tournaments(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament
      ON tournament_participants(tournament_id, joined_at ASC);
      CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_round
      ON tournament_matches(tournament_id, round, match_order);
      CREATE INDEX IF NOT EXISTS idx_organization_members_org_role
      ON organization_members(org_id, role, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_organization_members_user
      ON organization_members(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_organization_join_requests_org_status
      ON organization_join_requests(org_id, status, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_organization_join_requests_user_status
      ON organization_join_requests(user_id, status, updated_at DESC);
    `);

    console.log("Database tables initialized");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}
