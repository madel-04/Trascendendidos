import { io, Socket } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export const socket: Socket = io(API_BASE, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
  auth: {
    token: localStorage.getItem("authToken") ?? "",
  },
});

export function syncSocketAuthToken(): void {
  socket.auth = {
    token: localStorage.getItem("authToken") ?? "",
  };
}
