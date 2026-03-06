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
import { getOrCreatePlayerId, getUsername, setUsername as saveUsername } from '@/lib/playerId';
import { useAuth } from '@/context/AuthContext';
import { BottleColor, Feedback, GameStartData, RoundUpdateData, GameOverData, LobbyCreatedData, ErrorData, GameOverRewards } from '@/shared/types';
import { supabase } from '@/lib/supabase';
import * as Network from 'expo-network';

// ─── Types ────────────────────────────────────────────────

export type GamePhase = 'home' | 'matchmaking' | 'lobby' | 'playing' | 'finished';

export interface GameOverState {
    winnerId: string;
    reason: 'solved' | 'forfeit' | 'surrender';
    solution: BottleColor[];
    finalBoards: Record<string, BottleColor[]>;
    rewards?: GameOverRewards;
}

interface GameState {
    connected: boolean;
    connectionStatus: 'connecting' | 'connected' | 'error';
    connectionErrorMessage: string | null;
    phase: GamePhase;
    playerId: string | null;
    myUsername: string;
    opponentId: string | null;
    opponentUsername: string;
    gameId: string | null;
    lobbyCode: string | null;
    myEquippedFrame: string | null;
    opponentEquippedFrame: string | null;
    board: BottleColor[];
    roundNumber: number;
    roundDeadline: number;
    myMoveSubmitted: boolean;
    opponentSubmitted: boolean;
    myFeedback: Feedback | null;
    opponentFeedback: Feedback | null;
    gameOver: GameOverState | null;
    opponentConnected: boolean;
    error: ErrorData | null;
    hasPlayedIntro: boolean;
    isRanked: boolean;
    isMuted: boolean;
}

interface GameContextValue extends GameState {
    joinQuickMatch: () => void;
    joinRankedMatch: () => void;
    cancelQuickMatch: () => void;
    startAIGame: () => void;
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
    updateUsername: (name: string) => void;
    retryConnection: () => void;
    setIsMuted: (muted: boolean | ((prev: boolean) => boolean)) => void;
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
        connectionStatus: 'connecting',
        connectionErrorMessage: null,
        phase: 'home',
        playerId: null,
        myUsername: 'Player',
        opponentId: null,
        opponentUsername: 'Player',
        gameId: null,
        lobbyCode: null,
        myEquippedFrame: null,
        opponentEquippedFrame: null,
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
        hasPlayedIntro: false,
        isRanked: false,
        isMuted: false,
    });

    const { user, profile } = useAuth();

    // ─── Init socket once on mount ───────────────────────

    useEffect(() => {
        let cancelled = false;

        if (!user || !profile) return;

        const pid = profile.id;
        const username = profile.username;

        if (cancelled) return;

        playerIdRef.current = pid;
        setState((s) => ({ ...s, playerId: pid, myUsername: username }));

        const socket = getSocket(pid);
        socketRef.current = socket;

        // ─── Connection ───────────────────────────────

        socket.on('connect', () => {
            setState((s) => ({
                ...s,
                connected: true,
                connectionStatus: 'connected',
                connectionErrorMessage: null
            }));
        });

        socket.on('disconnect', () => {
            setState((s) => ({
                ...s,
                connected: false,
                connectionStatus: s.connectionStatus === 'error' ? 'error' : 'connecting'
            }));
        });

        socket.on('connect_error', async (err) => {
            const networkState = await Network.getNetworkStateAsync();
            if (!networkState.isConnected || !networkState.isInternetReachable) {
                setState((s) => ({
                    ...s,
                    connectionStatus: 'error',
                    connectionErrorMessage: 'Please check your internet connection.',
                }));
            } else {
                setState((s) => ({
                    ...s,
                    connectionStatus: 'error',
                    connectionErrorMessage: 'Error connecting to server. Please try again later.',
                }));
            }
        });

        // ─── Presence Heartbeat ────────────────────────
        const updatePresence = async () => {
            if (!pid) return;
            await supabase
                .from('profiles')
                .update({ last_seen: new Date().toISOString() })
                .eq('id', pid);
        };

        updatePresence(); // Initial ping
        const presenceInterval = setInterval(updatePresence, 60000); // Pulse every 60s

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
                opponentUsername: data.opponentUsername || 'Player',
                opponentEquippedFrame: data.opponentFrame || null,
                myEquippedFrame: data.yourFrame || null,
                board: data.board,
                roundNumber: data.roundNumber,
                roundDeadline: Date.now() + data.roundDuration,
                myMoveSubmitted: false,
                opponentSubmitted: false,
                lobbyCode: null,
                myFeedback: null,
                opponentFeedback: null,
                gameOver: null,
                opponentConnected: true,
                isRanked: data.isRanked || false,
            }));
        });

        socket.on('board:update', (data: { board: BottleColor[] }) => {
            setState((s) => ({ ...s, board: data.board }));
        });

        socket.on('round:update', (data: RoundUpdateData) => {
            setState((s) => ({
                ...s,
                roundNumber: data.roundNumber,
                roundDeadline: Date.now() + data.roundDuration,
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
                    rewards: data.rewards,
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

        // ─── App backgrounding ────────────────────────────

        const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (nextState === 'active' && socketRef.current && !socketRef.current.connected) {
                socketRef.current.connect();
            }
        });

        return () => {
            cancelled = true;
            sub.remove();
            if (socketRef.current) {
                socketRef.current.removeAllListeners();
            }
            clearInterval(presenceInterval);
        };
    }, [user, profile]);

    // ─── Actions ─────────────────────────────────────────

    const joinQuickMatch = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        setState((s) => ({ ...s, phase: 'matchmaking', error: null, isRanked: false }));
        socketRef.current.emit('join:quickmatch', { playerId: pid, username: state.myUsername });
    }, [state.myUsername]);

    const joinRankedMatch = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        setState((s) => ({ ...s, phase: 'matchmaking', error: null, isRanked: true }));
        socketRef.current.emit('join:ranked', { playerId: pid, username: state.myUsername });
    }, [state.myUsername]);

    const cancelQuickMatch = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        setState((s) => ({ ...s, phase: 'home' }));
        socketRef.current.emit('quickmatch:leave', { playerId: pid });
    }, []);

    const startAIGame = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        setState((s) => ({ ...s, phase: 'matchmaking', error: null, isRanked: false }));
        socketRef.current.emit('join:ai', { playerId: pid, username: state.myUsername });
    }, [state.myUsername]);

    const createLobby = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        setState((s) => ({ ...s, error: null }));
        socketRef.current.emit('lobby:create', { playerId: pid, username: state.myUsername });
    }, [state.myUsername]);

    const cancelLobby = useCallback(() => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        socketRef.current.emit('lobby:leave', { playerId: pid });
    }, []);

    const joinLobby = useCallback((code: string) => {
        const pid = playerIdRef.current;
        if (!socketRef.current || !pid) return;
        setState((s) => ({ ...s, phase: 'matchmaking', error: null, isRanked: false }));
        socketRef.current.emit('lobby:join', { playerId: pid, username: state.myUsername, code });
    }, [state.myUsername]);

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
            opponentUsername: 'Player',
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

    const setHasPlayedIntro = useCallback((played: boolean) => {
        setState((s) => ({ ...s, hasPlayedIntro: played }));
    }, []);

    const updateUsername = useCallback(async (name: string) => {
        if (!user || !profile) return;
        const trimmed = name.trim().slice(0, 15) || 'Player';

        const { error } = await supabase
            .from('profiles')
            .update({ username: trimmed })
            .eq('id', profile.id);

        if (!error) {
            setState((s) => ({ ...s, myUsername: trimmed }));
        } else {
            setState((s) => ({ ...s, error: { code: 'UPDATE_FAILED', message: error.message } }));
        }
    }, [user, profile]);

    const setIsMuted = useCallback((muted: boolean | ((prev: boolean) => boolean)) => {
        setState((s) => ({
            ...s,
            isMuted: typeof muted === 'function' ? muted(s.isMuted) : muted
        }));
    }, []);

    const retryConnection = useCallback(() => {
        setState((s) => ({ ...s, connectionStatus: 'connecting', connectionErrorMessage: null }));
        if (socketRef.current) {
            socketRef.current.connect();
        }
    }, []);

    return (
        <GameContext.Provider
            value={{
                ...state,
                joinQuickMatch,
                joinRankedMatch,
                cancelQuickMatch,
                startAIGame,
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
                updateUsername,
                retryConnection,
                setIsMuted,
            }}
        >
            {children}
        </GameContext.Provider>
    );
}
