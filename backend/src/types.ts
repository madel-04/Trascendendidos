// Tipos globales para el servidor Fastify

export type SocialRealtimeEvent =
  | "friend_request_received"
  | "friend_request_sent"
  | "friend_request_accepted"
  | "friend_request_rejected"
  | "user_blocked_you"
  | "user_unblocked_you"
  | "you_blocked_user"
  | "you_unblocked_user"
  | "chat_message_received"
  | "typing_indicator"
  | "typing_stopped"
  | "message_marked_read"
  | "match_invite_received"
  | "match_invite_sent"
  | "match_invite_accepted"
  | "match_invite_rejected"
  | "game_room_created"
  | "game_player_joined"
  | "game_player_ready"
  | "game_start";

export type SocialRealtimePayload = {
  channel: "social";
  event: SocialRealtimeEvent;
  ts: number;
  data?: Record<string, unknown>;
};

export type WsConnection = {
  send: (payload: string) => void;
  close: () => void;
  on: (event: string, listener: (...args: any[]) => void) => void;
  readyState?: number;
};
