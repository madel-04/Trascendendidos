// ─── Shared Socket.io event payload types ────────────────────────────────────

export interface PaddleMovePayload {
  roomId: string;
  player: 'left' | 'right';
  y: number; // 0-100 percentage of canvas height
}

export interface BallStatePayload {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface ScorePayload {
  left: number;
  right: number;
}

export interface MatchFoundPayload {
  roomId: string;
  side: 'left' | 'right';
  opponent: string; // opponent socket id
}

// Events the SERVER emits → CLIENT
export interface ServerToClientEvents {
  match_found: (payload: MatchFoundPayload) => void;
  paddle_moved: (payload: PaddleMovePayload) => void;
  ball_state: (payload: BallStatePayload) => void;
  score_update: (payload: ScorePayload) => void;
  opponent_disconnected: () => void;
  waiting_for_opponent: () => void;
}

// Events the CLIENT emits → SERVER
export interface ClientToServerEvents {
  join_matchmaking: () => void;
  leave_matchmaking: () => void;
  paddle_move: (payload: PaddleMovePayload) => void;
}

// Events for server-to-server (not used here, but required by Socket.io types)
export interface InterServerEvents {}

// Per-socket data stored on the socket object
export interface SocketData {
  roomId?: string;
  side?: 'left' | 'right';
}
