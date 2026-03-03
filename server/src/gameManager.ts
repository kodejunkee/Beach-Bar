import { v4 as uuidv4 } from 'uuid';
import { Server, Socket } from 'socket.io';
import {
    GameState,
    PlayerState,
    Player,
    BottleColor,
    Feedback,
    TURN_DURATION_MS,
    DISCONNECT_GRACE_MS,
    ClientToServerEvents,
    ServerToClientEvents,
} from './types';
import {
    generateSolution,
    generateScrambledBoard,
    validateSwap,
    applySwap,
    evaluateFeedback,
    checkWin,
} from './gameLogic';

/**
 * Manages active games: creation, turn flow, timers, disconnections.
 */
export class GameManager {
    /** Active games keyed by gameId */
    private games: Map<string, GameState> = new Map();
    /** Reverse lookup: playerId → gameId */
    private playerGameMap: Map<string, string> = new Map();
    /** Player info: playerId → Player */
    private players: Map<string, Player> = new Map();

    constructor(private io: Server<ClientToServerEvents, ServerToClientEvents>) { }

    // ─── Player Registration ─────────────────────────────────

    registerPlayer(playerId: string, socketId: string): void {
        this.players.set(playerId, { playerId, socketId, connected: true });
    }

    updatePlayerSocket(playerId: string, socketId: string): void {
        const player = this.players.get(playerId);
        if (player) {
            player.socketId = socketId;
            player.connected = true;
        }
    }

    getPlayer(playerId: string): Player | undefined {
        return this.players.get(playerId);
    }

    // ─── Game Creation ───────────────────────────────────────

    /**
     * Create a new game between two players. Sends `game:start` to both.
     */
    createGame(
        p1: { playerId: string; socketId: string },
        p2: { playerId: string; socketId: string }
    ): GameState {
        const gameId = uuidv4();
        const solution = generateSolution();
        const scrambledBoard = generateScrambledBoard(solution);

        // Randomly choose who goes first
        const playerOrder: [string, string] =
            Math.random() < 0.5
                ? [p1.playerId, p2.playerId]
                : [p2.playerId, p1.playerId];

        const activePlayerId = playerOrder[0];
        const turnDeadline = Date.now() + TURN_DURATION_MS;

        const game: GameState = {
            gameId,
            status: 'playing',
            solution,
            players: {
                [p1.playerId]: {
                    playerId: p1.playerId,
                    board: [...scrambledBoard],
                    preSwapBoard: null,
                    feedback: null,
                    hasSwapped: false,
                    moveSubmitted: false,
                },
                [p2.playerId]: {
                    playerId: p2.playerId,
                    board: [...scrambledBoard],
                    preSwapBoard: null,
                    feedback: null,
                    hasSwapped: false,
                    moveSubmitted: false,
                },
            },
            playerOrder,
            activePlayerId,
            turnNumber: 1,
            turnDeadline,
            turnTimer: null,
            winnerId: null,
            disconnectTimers: {},
        };

        this.games.set(gameId, game);
        this.playerGameMap.set(p1.playerId, gameId);
        this.playerGameMap.set(p2.playerId, gameId);

        // Register players
        this.registerPlayer(p1.playerId, p1.socketId);
        this.registerPlayer(p2.playerId, p2.socketId);

        // Send game:start to each player
        this.emitToPlayer(p1.playerId, 'game:start', {
            gameId,
            board: [...scrambledBoard],
            yourPlayerId: p1.playerId,
            opponentId: p2.playerId,
            activePlayerId,
            turnDeadline,
            turnDuration: TURN_DURATION_MS,
            turnNumber: 1,
        });
        this.emitToPlayer(p2.playerId, 'game:start', {
            gameId,
            board: [...scrambledBoard],
            yourPlayerId: p2.playerId,
            opponentId: p1.playerId,
            activePlayerId,
            turnDeadline,
            turnDuration: TURN_DURATION_MS,
            turnNumber: 1,
        });

        // Start turn timer
        this.startTurnTimer(gameId);

        return game;
    }

    // ─── Move Handling ───────────────────────────────────────

    /**
     * Handle a swap move from a player.
     */
    handleSwap(
        playerId: string,
        index1: number,
        index2: number
    ): void {
        const game = this.getPlayerGame(playerId);
        if (!game) return this.emitError(playerId, 'NOT_IN_GAME', 'You are not in a game');
        if (game.status !== 'playing') return;
        if (game.activePlayerId !== playerId) {
            return this.emitError(playerId, 'NOT_YOUR_TURN', 'It is not your turn');
        }

        const playerState = game.players[playerId];
        if (playerState.hasSwapped) {
            return this.emitError(playerId, 'ALREADY_SWAPPED', 'You have already swapped this turn');
        }
        if (playerState.moveSubmitted) {
            return this.emitError(playerId, 'ALREADY_SUBMITTED', 'Move already submitted');
        }

        if (!validateSwap(index1, index2, playerState.board.length)) {
            return this.emitError(playerId, 'INVALID_SWAP', 'Invalid swap indices');
        }

        // Apply swap
        playerState.preSwapBoard = [...playerState.board];
        playerState.board = applySwap(playerState.board, index1, index2);
        playerState.hasSwapped = true;

        // Confirm board update to this player only
        this.emitToPlayer(playerId, 'board:update', { board: [...playerState.board] });
    }

    /**
     * Handle undo: revert the last swap before submission.
     */
    handleUndo(playerId: string): void {
        const game = this.getPlayerGame(playerId);
        if (!game) return this.emitError(playerId, 'NOT_IN_GAME', 'You are not in a game');
        if (game.status !== 'playing') return;
        if (game.activePlayerId !== playerId) {
            return this.emitError(playerId, 'NOT_YOUR_TURN', 'It is not your turn');
        }

        const playerState = game.players[playerId];
        if (!playerState.hasSwapped || !playerState.preSwapBoard) {
            return this.emitError(playerId, 'NO_SWAP', 'No swap to undo');
        }
        if (playerState.moveSubmitted) {
            return this.emitError(playerId, 'ALREADY_SUBMITTED', 'Move already submitted');
        }

        // Restore pre-swap board
        playerState.board = playerState.preSwapBoard;
        playerState.preSwapBoard = null;
        playerState.hasSwapped = false;

        // Send the restored board
        this.emitToPlayer(playerId, 'board:update', { board: [...playerState.board] });
    }

    /**
     * Handle turn submission from a player.
     */
    handleSubmit(playerId: string): void {
        const game = this.getPlayerGame(playerId);
        if (!game) return this.emitError(playerId, 'NOT_IN_GAME', 'You are not in a game');
        if (game.status !== 'playing') return;
        if (game.activePlayerId !== playerId) {
            return this.emitError(playerId, 'NOT_YOUR_TURN', 'It is not your turn');
        }

        const playerState = game.players[playerId];
        if (playerState.moveSubmitted) {
            return; // Ignore duplicate submissions silently
        }

        playerState.moveSubmitted = true;
        this.processTurnEnd(game, playerId);
    }

    // ─── Turn Processing ────────────────────────────────────

    /**
     * Process the end of a turn: evaluate feedback, check win, advance turn.
     */
    private processTurnEnd(game: GameState, playerId: string): void {
        // Clear turn timer
        if (game.turnTimer) {
            clearTimeout(game.turnTimer);
            game.turnTimer = null;
        }

        const playerState = game.players[playerId];
        const feedback = evaluateFeedback(playerState.board, game.solution);
        playerState.feedback = feedback;

        // Check win
        if (checkWin(playerState.board, game.solution)) {
            this.endGame(game, playerId, 'solved');
            return;
        }

        // Advance to next turn
        this.advanceTurn(game);
    }

    /**
     * Advance to the next player's turn.
     */
    private advanceTurn(game: GameState): void {
        const currentIndex = game.playerOrder.indexOf(game.activePlayerId);
        const nextIndex = (currentIndex + 1) % 2;
        const nextPlayerId = game.playerOrder[nextIndex];

        game.activePlayerId = nextPlayerId;
        game.turnNumber++;
        game.turnDeadline = Date.now() + TURN_DURATION_MS;

        // Reset turn state for the next active player
        const nextPlayerState = game.players[nextPlayerId];
        nextPlayerState.hasSwapped = false;
        nextPlayerState.moveSubmitted = false;
        nextPlayerState.preSwapBoard = null;

        // Also reset the previous player's turn-specific flags
        const prevPlayerId = game.playerOrder[currentIndex];
        const prevPlayerState = game.players[prevPlayerId];
        prevPlayerState.hasSwapped = false;
        prevPlayerState.moveSubmitted = false;
        prevPlayerState.preSwapBoard = null;

        // Emit turn update to both players
        for (const pid of game.playerOrder) {
            const opponentId = game.playerOrder.find((id) => id !== pid)!;
            const myFeedback = game.players[pid].feedback;
            const opponentFeedback = game.players[opponentId].feedback;

            this.emitToPlayer(pid, 'turn:update', {
                activePlayerId: nextPlayerId,
                turnNumber: game.turnNumber,
                turnDeadline: game.turnDeadline,
                turnDuration: TURN_DURATION_MS,
                yourFeedback: myFeedback,
                opponentFeedback: opponentFeedback,
            });
        }

        // Start timer for next turn
        this.startTurnTimer(game.gameId);
    }

    // ─── Timer ───────────────────────────────────────────────

    /**
     * Start the 15-second turn timer. On expiry, auto-submit.
     */
    private startTurnTimer(gameId: string): void {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'playing') return;

        game.turnTimer = setTimeout(() => {
            const g = this.games.get(gameId);
            if (!g || g.status !== 'playing') return;

            const activePlayer = g.players[g.activePlayerId];
            if (!activePlayer.moveSubmitted) {
                activePlayer.moveSubmitted = true;
                this.processTurnEnd(g, g.activePlayerId);
            }
        }, TURN_DURATION_MS);
    }

    // ─── Game End ────────────────────────────────────────────

    /**
     * End the game with a winner and reason.
     */
    private endGame(game: GameState, winnerId: string, reason: 'solved' | 'forfeit' | 'surrender'): void {
        game.status = 'finished';
        game.winnerId = winnerId;

        if (game.turnTimer) {
            clearTimeout(game.turnTimer);
            game.turnTimer = null;
        }

        const finalBoards: Record<string, BottleColor[]> = {};
        for (const pid of game.playerOrder) {
            finalBoards[pid] = [...game.players[pid].board];
        }

        // Emit game:over to both players — solution is revealed HERE only
        for (const pid of game.playerOrder) {
            this.emitToPlayer(pid, 'game:over', {
                winnerId,
                reason,
                solution: [...game.solution],
                finalBoards,
            });
        }

        // Cleanup after a short delay
        setTimeout(() => this.cleanupGame(game.gameId), 5000);
    }

    /**
     * Clean up a finished game from memory.
     */
    private cleanupGame(gameId: string): void {
        const game = this.games.get(gameId);
        if (!game) return;

        for (const pid of game.playerOrder) {
            this.playerGameMap.delete(pid);
            // Clear any disconnect timers
            if (game.disconnectTimers[pid]) {
                clearTimeout(game.disconnectTimers[pid]);
            }
        }
        this.games.delete(gameId);
    }

    // ─── Disconnect / Reconnect ──────────────────────────────

    /**
     * Handle a player disconnecting.
     */
    handleDisconnect(playerId: string): void {
        const player = this.players.get(playerId);
        if (player) player.connected = false;

        const game = this.getPlayerGame(playerId);
        if (!game || game.status !== 'playing') return;

        // Notify opponent
        const opponentId = game.playerOrder.find((id) => id !== playerId);
        if (opponentId) {
            this.emitToPlayer(opponentId, 'opponent:status', { connected: false });
        }

        // Start grace period timer
        game.disconnectTimers[playerId] = setTimeout(() => {
            const g = this.getPlayerGame(playerId);
            if (g && g.status === 'playing') {
                const opponent = g.playerOrder.find((id) => id !== playerId);
                if (opponent) {
                    this.endGame(g, opponent, 'forfeit');
                }
            }
        }, DISCONNECT_GRACE_MS);
    }

    /**
     * Handle a player voluntarily surrendering.
     */
    handleSurrender(playerId: string): void {
        const game = this.getPlayerGame(playerId);
        if (!game || game.status !== 'playing') return;
        const opponentId = game.playerOrder.find((id) => id !== playerId);
        if (opponentId) {
            this.endGame(game, opponentId, 'surrender');
        }
    }

    /**
     * Handle a player reconnecting to an active game.
     */
    handleReconnect(playerId: string, gameId: string, socketId: string): void {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'playing') {
            this.emitToSocket(socketId, 'error', {
                code: 'GAME_NOT_FOUND',
                message: 'Game no longer exists',
            });
            return;
        }

        if (!game.players[playerId]) {
            this.emitToSocket(socketId, 'error', {
                code: 'NOT_IN_GAME',
                message: 'You are not in this game',
            });
            return;
        }

        // Cancel disconnect timer
        if (game.disconnectTimers[playerId]) {
            clearTimeout(game.disconnectTimers[playerId]);
            delete game.disconnectTimers[playerId];
        }

        // Update socket
        this.updatePlayerSocket(playerId, socketId);

        // Notify opponent
        const opponentId = game.playerOrder.find((id) => id !== playerId);
        if (opponentId) {
            this.emitToPlayer(opponentId, 'opponent:status', { connected: true });
        }

        // Re-send current game state to reconnected player
        const playerState = game.players[playerId];
        this.emitToPlayer(playerId, 'game:start', {
            gameId: game.gameId,
            board: [...playerState.board],
            yourPlayerId: playerId,
            opponentId: opponentId || '',
            activePlayerId: game.activePlayerId,
            turnDeadline: game.turnDeadline,
            turnDuration: TURN_DURATION_MS,
            turnNumber: game.turnNumber,
        });
    }

    // ─── Helpers ─────────────────────────────────────────────

    /** Get the game a player is in. */
    getPlayerGame(playerId: string): GameState | undefined {
        const gameId = this.playerGameMap.get(playerId);
        if (!gameId) return undefined;
        return this.games.get(gameId);
    }

    /** Check if a player is currently in a game. */
    isPlayerInGame(playerId: string): boolean {
        return this.playerGameMap.has(playerId);
    }

    /** Emit an event to a specific player by playerId. */
    private emitToPlayer<E extends keyof ServerToClientEvents>(
        playerId: string,
        event: E,
        ...args: Parameters<ServerToClientEvents[E]>
    ): void {
        const player = this.players.get(playerId);
        if (player?.connected) {
            this.io.to(player.socketId).emit(event, ...args);
        }
    }

    /** Emit an event directly to a socket ID. */
    private emitToSocket<E extends keyof ServerToClientEvents>(
        socketId: string,
        event: E,
        ...args: Parameters<ServerToClientEvents[E]>
    ): void {
        this.io.to(socketId).emit(event, ...args);
    }

    /** Emit an error to a player. */
    private emitError(playerId: string, code: string, message: string): void {
        this.emitToPlayer(playerId, 'error', { code, message });
    }
}
