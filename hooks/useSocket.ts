import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '@/lib/socket';
import {
    BottleColor,
    Feedback,
    GameStartData,
    RoundUpdateData,
    GameOverData,
    LobbyCreatedData,
    ErrorData,
} from '@/shared/types';

export type GamePhase = 'home' | 'matchmaking' | 'lobby' | 'playing' | 'finished';

export interface GameOverState {
    winnerId: string;
    reason: 'solved' | 'forfeit' | 'surrender';
    solution: BottleColor[];
    finalBoards: Record<string, BottleColor[]>;
}

interface UseSocketState {
    // Connection
    connected: boolean;
    // Phase
    phase: GamePhase;
    // Lobby
    lobbyCode: string | null;
    // Game
    gameId: string | null;
    playerId: string | null;
    opponentId: string | null;
    board: BottleColor[];
    roundNumber: number;
    roundDeadline: number;
    myMoveSubmitted: boolean;
    opponentSubmitted: boolean;
    myFeedback: Feedback | null;
    opponentFeedback: Feedback | null;
    gameOver: GameOverState | null;
    opponentConnected: boolean;
    // Error
    error: ErrorData | null;
}

interface UseSocketActions {
    joinQuickMatch: () => void;
    createLobby: () => void;
    joinLobby: (code: string) => void;
    sendSwap: (index1: number, index2: number) => void;
    undoMove: () => void;
    submitTurn: () => void;
    surrender: () => void;
    resetToHome: () => void;
    clearError: () => void;
}

export function useSocket(playerId: string | null): UseSocketState & UseSocketActions {
    const socketRef = useRef<Socket | null>(null);

    const [state, setState] = useState<UseSocketState>({
        connected: false,
        phase: 'home',
        lobbyCode: null,
        gameId: null,
        playerId: null,
        opponentId: null,
        board: [],
        roundNumber: 0,
        roundDeadline: 0,
        myMoveSubmitted: false,
        opponentSubmitted: false,
        myFeedback: null,
        opponentFeedback: null,
        gameOver: null,
        opponentConnected: true,
        error: null,
    });

    // ─── Connect ──────────────────────────────────────────

    useEffect(() => {
        if (!playerId) return;

        const socket = getSocket(playerId);
        socketRef.current = socket;

        socket.on('connect', () => {
            setState((s) => ({ ...s, connected: true, playerId }));
        });

        socket.on('disconnect', () => {
            setState((s) => ({ ...s, connected: false }));
        });

        // ─── Lobby Events ─────────────────────────────────

        socket.on('lobby:created', (data: LobbyCreatedData) => {
            setState((s) => ({ ...s, phase: 'lobby', lobbyCode: data.code }));
        });

        socket.on('lobby:joined', () => {
            // Game start will follow immediately
        });

        socket.on('lobby:expired', () => {
            setState((s) => ({
                ...s,
                phase: 'home',
                lobbyCode: null,
                error: { code: 'LOBBY_EXPIRED', message: 'Lobby expired' },
            }));
        });

        // ─── Game Events ──────────────────────────────────

        socket.on('game:start', (data: GameStartData) => {
            setState((s) => ({
                ...s,
                phase: 'playing',
                gameId: data.gameId,
                playerId: data.yourPlayerId,
                opponentId: data.opponentId,
                board: data.board,
                roundNumber: data.roundNumber,
                roundDeadline: data.roundDeadline,
                myMoveSubmitted: false,
                opponentSubmitted: false,
                lobbyCode: null,
                myFeedback: null,
                opponentFeedback: null,
                gameOver: null,
                opponentConnected: true,
            }));
        });

        socket.on('board:update', (data: { board: BottleColor[] }) => {
            setState((s) => ({ ...s, board: data.board }));
        });

        socket.on('round:update', (data: RoundUpdateData) => {
            setState((s) => ({
                ...s,
                roundNumber: data.roundNumber,
                roundDeadline: data.roundDeadline,
                myMoveSubmitted: false,
                opponentSubmitted: false,
                myFeedback: data.yourFeedback,
                opponentFeedback: data.opponentFeedback,
            }));
        });

        socket.on('player:submitted', (data: { playerId: string }) => {
            setState((s) => {
                if (data.playerId === s.opponentId) {
                    return { ...s, opponentSubmitted: true };
                }
                return s;
            });
        });

        socket.on('game:over', (data: GameOverData) => {
            setState((s) => ({
                ...s,
                phase: 'finished',
                gameOver: {
                    winnerId: data.winnerId,
                    reason: data.reason,
                    solution: data.solution,
                    finalBoards: data.finalBoards,
                },
            }));
        });

        socket.on('opponent:status', (data: { connected: boolean }) => {
            setState((s) => ({ ...s, opponentConnected: data.connected }));
        });

        // ─── Error Events ─────────────────────────────────

        socket.on('error', (data: ErrorData) => {
            setState((s) => ({ ...s, error: data }));
        });

        // ─── App State (backgrounding) ────────────────────

        const handleAppState = (nextState: AppStateStatus) => {
            if (nextState === 'active' && socketRef.current && !socketRef.current.connected) {
                socketRef.current.connect();
            }
        };
        const sub = AppState.addEventListener('change', handleAppState);

        return () => {
            sub.remove();
            socket.removeAllListeners();
            disconnectSocket();
        };
    }, [playerId]);

    // ─── Actions ──────────────────────────────────────────

    const joinQuickMatch = useCallback(() => {
        if (!socketRef.current || !playerId) return;
        setState((s) => ({ ...s, phase: 'matchmaking', error: null }));
        socketRef.current.emit('join:quickmatch', { playerId });
    }, [playerId]);

    const createLobby = useCallback(() => {
        if (!socketRef.current || !playerId) return;
        setState((s) => ({ ...s, error: null }));
        socketRef.current.emit('lobby:create', { playerId });
    }, [playerId]);

    const joinLobby = useCallback(
        (code: string) => {
            if (!socketRef.current || !playerId) return;
            setState((s) => ({ ...s, phase: 'matchmaking', error: null }));
            socketRef.current.emit('lobby:join', { playerId, code });
        },
        [playerId]
    );

    const sendSwap = useCallback((index1: number, index2: number) => {
        if (!socketRef.current) return;
        socketRef.current.emit('move:swap', { index1, index2 });
    }, []);

    const undoMove = useCallback(() => {
        if (!socketRef.current) return;
        socketRef.current.emit('move:undo');
    }, []);

    const submitTurn = useCallback(() => {
        if (!socketRef.current) return;
        setState((s) => ({ ...s, myMoveSubmitted: true }));
        socketRef.current.emit('turn:submit');
    }, []);

    const surrender = useCallback(() => {
        if (!socketRef.current || !playerId) return;
        socketRef.current.emit('game:surrender', { playerId });
    }, [playerId]);

    const resetToHome = useCallback(() => {
        setState((s) => ({
            ...s,
            phase: 'home',
            lobbyCode: null,
            gameId: null,
            opponentId: null,
            board: [],
            roundNumber: 0,
            roundDeadline: 0,
            myMoveSubmitted: false,
            opponentSubmitted: false,
            myFeedback: null,
            opponentFeedback: null,
            gameOver: null,
            opponentConnected: true,
            error: null,
        }));
    }, []);

    const clearError = useCallback(() => {
        setState((s) => ({ ...s, error: null }));
    }, []);

    return {
        ...state,
        joinQuickMatch,
        createLobby,
        joinLobby,
        sendSwap,
        undoMove,
        submitTurn,
        surrender,
        resetToHome,
        clearError,
    };
}
