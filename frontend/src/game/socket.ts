import { io, Socket } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
let lastAuthToken = localStorage.getItem("authToken") ?? "";

export const socket: Socket = io(API_BASE, {
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
