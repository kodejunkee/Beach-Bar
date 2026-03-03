// ═══ Client-safe subset of types ═══
// (No solution or server-internal fields)

export const BOTTLE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export type BottleColor = (typeof BOTTLE_COLORS)[number];

export const BOARD_SIZE = 6;

export interface Feedback {
    correct: number;
    incorrect: number;
}

export interface GameStartData {
    gameId: string;
    board: BottleColor[];
    yourPlayerId: string;
    opponentId: string;
    activePlayerId: string;
    turnDeadline: number;
    turnDuration: number;
    turnNumber: number;
}

export interface TurnUpdateData {
    activePlayerId: string;
    turnNumber: number;
    turnDeadline: number;
    turnDuration: number;
    yourFeedback: Feedback | null;
    opponentFeedback: Feedback | null;
}

export interface GameOverData {
    winnerId: string;
    reason: 'solved' | 'forfeit' | 'surrender';
    solution: BottleColor[];
    finalBoards: Record<string, BottleColor[]>;
}

export interface LobbyCreatedData {
    lobbyId: string;
    code: string;
}

export interface ErrorData {
    code: string;
    message: string;
}
