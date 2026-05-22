import { io, Socket } from "socket.io-client";
import { BACKEND_URL } from "../lib/backend";
let lastAuthToken = localStorage.getItem("authToken") ?? "";

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["polling"],
  upgrade: false,
  auth: {
    token: lastAuthToken,
  },
});

export function syncSocketAuthToken(): void {
  const nextToken = localStorage.getItem("authToken") ?? "";
  socket.auth = {
    token: nextToken,
  };

  if (socket.connected && nextToken !== lastAuthToken) {
    socket.disconnect();
    socket.connect();
  }

  lastAuthToken = nextToken;
}
