import { io } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || "";
// Strip the /api suffix for the socket connection root
const SOCKET_URL = BASE_URL.replace(/\/api\/?$/, "");

let socket = null;

export function getSocket() {
  return socket;
}

export function connectPosSocket({ businessId, token, onEvent, onConnect, onDisconnect }) {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    autoConnect: false,
  });

  socket.on("connect", () => {
    socket.emit("pos:join", { businessId, token });
    onConnect?.();
  });

  socket.on("pos:joined", () => {});

  socket.on("pos:event", (data) => {
    onEvent?.(data);
  });

  socket.on("disconnect", () => {
    onDisconnect?.();
  });

  socket.connect();
  return socket;
}

export function disconnectPosSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
