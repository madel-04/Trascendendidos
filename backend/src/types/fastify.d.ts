import "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { SocialRealtimeEvent } from "../types.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    notifySocialUser(
      userId: number,
      event: SocialRealtimeEvent,
      data?: Record<string, unknown>
    ): void;
  }
}
