import { io, Socket } from 'socket.io-client';

// Use your local network IP in dev, production URL in prod
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3001';
console.log('[socket] Connecting to:', SERVER_URL);

let socket: Socket | null = null;

/**
 * Get or create the Socket.IO client singleton.
 * Connects with the player's anonymous ID for auth.
 */
export function getSocket(playerId: string): Socket {
    if (socket && socket.connected) {
        return socket;
    }

    if (socket) {
        // Update auth and reconnect
        socket.auth = { playerId };
        socket.connect();
        return socket;
    }

    socket = io(SERVER_URL, {
        auth: { playerId },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ['polling', 'websocket'], // polling first, then upgrade to ws
    });

    return socket;
}

/**
 * Disconnect and clean up the socket.
 */
export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
