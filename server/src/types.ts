// ═══ Constants ═══
export const BOTTLE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export type BottleColor = (typeof BOTTLE_COLORS)[number];

export const BOARD_SIZE = 6;
export const TURN_DURATION_MS = 15_000;
export const LOBBY_EXPIRY_MS = 300_000; // 5 minutes
export const DISCONNECT_GRACE_MS = 30_000;

// ═══ Feedback ═══
export interface Feedback {
    correct: number;
    incorrect: number;
}

// ═══ Player ═══
export interface Player {
    playerId: string;
    socketId: string;
    connected: boolean;
}

export interface PlayerState {
    playerId: string;
    board: BottleColor[];
    preSwapBoard: BottleColor[] | null;
    feedback: Feedback | null;
    hasSwapped: boolean;
    moveSubmitted: boolean;
}

// ═══ Game State ═══
export interface GameState {
    gameId: string;
    status: 'playing' | 'finished';
    solution: BottleColor[];
    players: Record<string, PlayerState>;
    playerOrder: [string, string];
    activePlayerId: string;
    turnNumber: number;
    turnDeadline: number;
    turnTimer: ReturnType<typeof setTimeout> | null;
    winnerId: string | null;
    disconnectTimers: Record<string, ReturnType<typeof setTimeout>>;
}

// ═══ Lobby ═══
export interface Lobby {
    lobbyId: string;
    code: string;
    hostPlayerId: string;
    guestPlayerId: string | null;
    status: 'waiting' | 'full' | 'expired';
    createdAt: number;
    expiryTimer: ReturnType<typeof setTimeout> | null;
}

// ═══ Client → Server Events ═══
export interface ClientToServerEvents {
    'join:quickmatch': (data: { playerId: string }) => void;
    'quickmatch:leave': (data: { playerId: string }) => void;
    'lobby:create': (data: { playerId: string }) => void;
    'lobby:join': (data: { playerId: string; code: string }) => void;
    'lobby:leave': (data: { playerId: string }) => void;
    'move:swap': (data: { index1: number; index2: number }) => void;
    'move:undo': () => void;
    'turn:submit': () => void;
    'game:surrender': (data: { playerId: string }) => void;
    'reconnect:game': (data: { playerId: string; gameId: string }) => void;
}

// ═══ Server → Client Events ═══
export interface ServerToClientEvents {
    'quickmatch:cancelled': () => void;
    'lobby:created': (data: { lobbyId: string; code: string }) => void;
    'lobby:joined': (data: { opponentJoined: boolean }) => void;
    'lobby:expired': () => void;
    'lobby:cancelled': () => void;
    'game:start': (data: {
        gameId: string;
        board: BottleColor[];
        yourPlayerId: string;
        opponentId: string;
        activePlayerId: string;
        turnDeadline: number;
        turnDuration: number;
        turnNumber: number;
    }) => void;
    'board:update': (data: { board: BottleColor[] }) => void;
    'turn:update': (data: {
        activePlayerId: string;
        turnNumber: number;
        turnDeadline: number;
        turnDuration: number;
        yourFeedback: Feedback | null;
        opponentFeedback: Feedback | null;
    }) => void;
    'game:over': (data: {
        winnerId: string;
        reason: 'solved' | 'forfeit' | 'surrender';
        solution: BottleColor[];
        finalBoards: Record<string, BottleColor[]>;
    }) => void;
    'opponent:status': (data: { connected: boolean }) => void;
    'error': (data: { code: string; message: string }) => void;
}
