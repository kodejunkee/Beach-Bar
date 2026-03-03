import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { getOrCreatePlayerId } from '@/lib/playerId';
import {
    BottleColor,
    Feedback,
    GameStartData,
    TurnUpdateData,
    GameOverData,
    LobbyCreatedData,
    ErrorData,
} from '@/shared/types';

// ─── Types ────────────────────────────────────────────────

export type GamePhase = 'home' | 'matchmaking' | 'lobby' | 'playing' | 'finished';

export interface GameOverState {
    winnerId: string;
    reason: 'solved' | 'forfeit' | 'surrender';
    solution: BottleColor[];
    finalBoards: Record<string, BottleColor[]>;
}

interface GameState {
    connected: boolean;
    phase: GamePhase;
    playerId: string | null;
    opponentId: string | null;
    gameId: string | null;
    lobbyCode: string | null;
    board: BottleColor[];
    activePlayerId: string | null;
    turnNumber: number;
    turnDeadline: number;
    turnDuration: number;
    myFeedback: Feedback | null;
    opponentFeedback: Feedback | null;
    gameOver: GameOverState | null;
    opponentConnected: boolean;
    error: ErrorData | null;
    hasPlayedIntro: boolean;
}

interface GameContextValue extends GameState {
    joinQuickMatch: () => void;
    cancelQuickMatch: () => void;
    createLobby: () => void;
    cancelLobby: () => void;
    joinLobby: (code: string) => void;
    sendSwap: (index1: number, index2: number) => void;
    undoMove: () => void;
    submitTurn: () => void;
    surrender: () => void;
    resetToHome: () => void;
    clearError: () => void;
    setHasPlayedIntro: (played: boolean) => void;
}

// ─── Context ─────────────────────────────────────────────

const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
    const ctx = useContext(GameContext);
    if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
    return ctx;
}

// ─── Provider ────────────────────────────────────────────

export function GameProvider({ children }: { children: React.ReactNode }) {
    const socketRef = useRef<Socket | null>(null);
    const playerIdRef = useRef<string | null>(null);

    const [state, setState] = useState<GameState>({
        connected: false,
        phase: 'home',
        playerId: null,
        opponentId: null,
        gameId: null,
        lobbyCode: null,
        board: [],
        activePlayerId: null,
        turnNumber: 0,
        turnDeadline: 0,
        turnDuration: 15000,
        myFeedback: null,
        opponentFeedback: null,
        gameOver: null,
        opponentConnected: true,
        error: null,
        hasPlayedIntro: false,
    });

    // ─── Init socket once on mount ───────────────────────

    useEffect(() => {
        let cancelled = false;

        getOrCreatePlayerId().then((pid) => {
            if (cancelled) return;

            playerIdRef.current = pid;
            setState((s) => ({ ...s, playerId: pid }));

            const socket = getSocket(pid);
            socketRef.current = socket;

            // ─── Connection ───────────────────────────────

            socket.on('connect', () => {
                setState((s) => ({ ...s, connected: true }));
            });

            socket.on('disconnect', () => {
                setState((s) => ({ ...s, connected: false }));
            });

            // ─── Lobby Events ─────────────────────────────

            socket.on('lobby:created', (data: LobbyCreatedData) => {
                setState((s) => ({ ...s, phase: 'lobby', lobbyCode: data.code }));
            });

            socket.on('quickmatch:cancelled', () => {
                setState((s) => ({ ...s, phase: 'home' }));
            });

            socket.on('lobby:expired', () => {
                setState((s) => ({
                    ...s,
                    phase: 'home',
                    lobbyCode: null,
                    error: { code: 'LOBBY_EXPIRED', message: 'Lobby expired — it was not joined in time.' },
                }));
            });

            socket.on('lobby:cancelled', () => {
                setState((s) => ({ ...s, phase: 'home', lobbyCode: null }));
            });

            // ─── Game Events ──────────────────────────────

            socket.on('game:start', (data: GameStartData) => {
                setState((s) => ({
                    ...s,
                    phase: 'playing',
                    gameId: data.gameId,
                    playerId: data.yourPlayerId,
                    opponentId: data.opponentId,
                    board: data.board,
                    activePlayerId: data.activePlayerId,
                    turnNumber: data.turnNumber,
                    turnDeadline: data.turnDeadline,
                    turnDuration: data.turnDuration,
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

            socket.on('turn:update', (data: TurnUpdateData) => {
                setState((s) => ({
                    ...s,
                    activePlayerId: data.activePlayerId,
                    turnNumber: data.turnNumber,
                    turnDeadline: data.turnDeadline,
                    turnDuration: data.turnDuration,
                    myFeedback: data.yourFeedback,
                    opponentFeedback: data.opponentFeedback,
                }));
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

            socket.on('error', (data: ErrorData) => {
                // Don't change phase for non-critical errors
                setState((s) => ({ ...s, error: data }));
            });
        });

        // ─── App backgrounding ────────────────────────────

        const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (nextState === 'active' && socketRef.current && !socketRef.current.connected) {
                socketRef.current.connect();
            }
        });

        return () => {
            cancelled = true;
            sub.remove();
            // NOTE: We do NOT disconnect the socket here on purpose —
            // the Provider lives at root level for the entire app lifetime.
        };
    }, []);

    // ─── Actions ─────────────────────────────────────────

    const joinQuickMatch = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        setState((s) => ({ ...s, phase: 'matchmaking', error: null }));
        socketRef.current.emit('join:quickmatch', { playerId: pid });
    }, []);

    const cancelQuickMatch = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;

        // Optimistically return home immediately for snappy UI
        setState((s) => ({ ...s, phase: 'home' }));

        socketRef.current.emit('quickmatch:leave', { playerId: pid });
    }, []);

    const createLobby = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        setState((s) => ({ ...s, error: null }));
        socketRef.current.emit('lobby:create', { playerId: pid });
    }, []);

    const cancelLobby = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        socketRef.current.emit('lobby:leave', { playerId: pid });
    }, []);

    const joinLobby = useCallback((code: string) => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        setState((s) => ({ ...s, phase: 'matchmaking', error: null }));
        socketRef.current.emit('lobby:join', { playerId: pid, code });
    }, []);

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
        socketRef.current.emit('turn:submit');
    }, []);

    const surrender = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        socketRef.current.emit('game:surrender', { playerId: pid });
    }, []);

    const resetToHome = useCallback(() => {
        setState((s) => ({
            ...s,
            phase: 'home',
            lobbyCode: null,
            gameId: null,
            opponentId: null,
            board: [],
            activePlayerId: null,
            turnNumber: 0,
            turnDeadline: 0,
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

    const setHasPlayedIntro = useCallback((played: boolean) => {
        setState((s) => ({ ...s, hasPlayedIntro: played }));
    }, []);

    return (
        <GameContext.Provider
            value={{
                ...state,
                joinQuickMatch,
                cancelQuickMatch,
                createLobby,
                cancelLobby,
                joinLobby,
                sendSwap,
                undoMove,
                submitTurn,
                surrender,
                resetToHome,
                clearError,
                setHasPlayedIntro,
            }}
        >
            {children}
        </GameContext.Provider>
    );
}
