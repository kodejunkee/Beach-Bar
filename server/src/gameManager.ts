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
    GameOverRewards,
} from './types';
import {
    generateSolution,
    generateScrambledBoard,
    validateSwap,
    applySwap,
    evaluateFeedback,
    checkWin,
} from './gameLogic';
import { supabaseAdmin } from './supabase';
import { computeAIMove, getAIThinkDelay, cleanupAI } from './aiPlayer';

// ─── Leveling helpers ────────────────────────────────────────
const REWARD_WINNER_EXP = 30;
const REWARD_WINNER_GOLD = 15;
const REWARD_LOSER_EXP = 10;
const REWARD_LOSER_GOLD = 5;

function requiredExpForLevel(level: number): number {
    return Math.floor(50 * Math.pow(level, 1.5));
}

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

    registerPlayer(playerId: string, socketId: string, username: string = 'Player'): void {
        const existing = this.players.get(playerId);
        const resolvedUsername = username !== 'Player' ? username : (existing?.username || 'Player');
        this.players.set(playerId, { playerId, socketId, username: resolvedUsername, connected: true });
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
    async createGame(
        p1: { playerId: string; socketId: string; username: string },
        p2: { playerId: string; socketId: string; username: string },
        isRanked: boolean = false
    ): Promise<GameState> {
        const gameId = uuidv4();
        const solution = generateSolution();
        const scrambledBoard = generateScrambledBoard(solution);

        const playerOrder: [string, string] =
            Math.random() < 0.5
                ? [p1.playerId, p2.playerId]
                : [p2.playerId, p1.playerId];

        const roundDeadline = Date.now() + TURN_DURATION_MS;

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
            roundNumber: 1,
            roundDeadline,
            roundTimer: null,
            winnerId: null,
            disconnectTimers: {},
            isRanked,
        };
        this.games.set(gameId, game);
        this.playerGameMap.set(p1.playerId, gameId);
        this.playerGameMap.set(p2.playerId, gameId);

        // Register players
        this.registerPlayer(p1.playerId, p1.socketId, p1.username);
        this.registerPlayer(p2.playerId, p2.socketId, p2.username);

        // Fetch frames
        const getFrame = async (pid: string) => {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('equipped_frame, shop_items!equipped_frame(asset_url)')
                .eq('id', pid)
                .single();
            return (data as any)?.shop_items?.asset_url || null;
        };

        const [p1Frame, p2Frame] = await Promise.all([getFrame(p1.playerId), getFrame(p2.playerId)]);

        // Send game:start to each player
        this.emitToPlayer(p1.playerId, 'game:start', {
            gameId,
            board: [...scrambledBoard],
            yourPlayerId: p1.playerId,
            yourFrame: p1Frame,
            opponentId: p2.playerId,
            opponentUsername: p2.username,
            opponentFrame: p2Frame,
            roundDeadline,
            roundDuration: TURN_DURATION_MS,
            roundNumber: 1,
            isRanked: game.isRanked,
        });
        this.emitToPlayer(p2.playerId, 'game:start', {
            gameId,
            board: [...scrambledBoard],
            yourPlayerId: p2.playerId,
            yourFrame: p2Frame,
            opponentId: p1.playerId,
            opponentUsername: p1.username,
            opponentFrame: p1Frame,
            roundDeadline,
            roundDuration: TURN_DURATION_MS,
            roundNumber: 1,
            isRanked: game.isRanked,
        });

        // Start round timer
        this.startRoundTimer(gameId);

        return game;
    }

    /**
     * Create a single-player game against AI.
     */
    async createAIGame(
        player: { playerId: string; socketId: string; username: string }
    ): Promise<GameState> {
        const aiId = `ai-${uuidv4().slice(0, 8)}`;
        const gameId = uuidv4();
        const solution = generateSolution();
        const scrambledBoard = generateScrambledBoard(solution);

        const playerOrder: [string, string] = [player.playerId, aiId];
        const roundDeadline = Date.now() + TURN_DURATION_MS;

        const game: GameState = {
            gameId,
            status: 'playing',
            solution,
            players: {
                [player.playerId]: {
                    playerId: player.playerId,
                    board: [...scrambledBoard],
                    preSwapBoard: null,
                    feedback: null,
                    hasSwapped: false,
                    moveSubmitted: false,
                },
                [aiId]: {
                    playerId: aiId,
                    board: [...scrambledBoard],
                    preSwapBoard: null,
                    feedback: null,
                    hasSwapped: false,
                    moveSubmitted: false,
                },
            },
            playerOrder,
            roundNumber: 1,
            roundDeadline,
            roundTimer: null,
            winnerId: null,
            disconnectTimers: {},
            isRanked: false,
        };

        this.games.set(gameId, game);
        this.playerGameMap.set(player.playerId, gameId);
        this.playerGameMap.set(aiId, gameId);

        // Register human player
        this.registerPlayer(player.playerId, player.socketId, player.username);
        // Register AI as a virtual player (no real socket)
        this.players.set(aiId, {
            playerId: aiId,
            socketId: 'ai-socket',
            username: 'AI Bot',
            connected: true,
        });

        // Fetch guest frame (AI has none)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('equipped_frame, shop_items!equipped_frame(asset_url)')
            .eq('id', player.playerId)
            .single();

        const opponentFrame = null; // AI has no frame for now

        // Fetch user frame
        const yourFrame = (profile as any)?.shop_items?.asset_url || null;

        // Send game:start only to the human player
        this.emitToPlayer(player.playerId, 'game:start', {
            gameId,
            board: [...scrambledBoard],
            yourPlayerId: player.playerId,
            yourFrame,
            opponentId: aiId,
            opponentUsername: 'AI Bot',
            opponentFrame,
            roundDeadline,
            roundDuration: TURN_DURATION_MS,
            roundNumber: 1,
            isRanked: false,
        });

        this.startRoundTimer(gameId);

        // Schedule the AI's first move
        this.scheduleAIMove(game, aiId);

        return game;
    }

    /**
     * Schedule the AI to make a move after a thinking delay.
     */
    private scheduleAIMove(game: GameState, aiId: string): void {
        if (game.status !== 'playing') return;
        const aiState = game.players[aiId];
        if (!aiState || aiState.moveSubmitted) return;

        const delay = getAIThinkDelay();
        setTimeout(() => {
            if (game.status !== 'playing') return;
            if (aiState.moveSubmitted) return;

            // Compute and apply the AI's swap (new TRULY BLIND AI logic)
            const move = computeAIMove(aiId, aiState.board, aiState.feedback);
            if (validateSwap(move.index1, move.index2, aiState.board.length)) {
                aiState.preSwapBoard = [...aiState.board];
                aiState.board = applySwap(aiState.board, move.index1, move.index2);
                aiState.hasSwapped = true;
            }

            // Mark AI as submitted
            aiState.moveSubmitted = true;

            // Notify human that opponent submitted
            const humanId = game.playerOrder.find(id => id !== aiId)!;
            this.emitToPlayer(humanId, 'player:submitted', { playerId: aiId });

            // If human already submitted, process round end
            const humanState = game.players[humanId];
            if (humanState.moveSubmitted) {
                this.processRoundEnd(game);
            }
        }, delay);
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

        const playerState = game.players[playerId];
        if (playerState.moveSubmitted) {
            return; // Ignore duplicate submissions silently
        }

        playerState.moveSubmitted = true;

        const opponentId = game.playerOrder.find(id => id !== playerId)!;
        const opponentState = game.players[opponentId];

        // Notify the opponent that this player has submitted
        this.emitToPlayer(opponentId, 'player:submitted', { playerId });

        if (opponentState.moveSubmitted) {
            // Both players done — resolve the round
            this.processRoundEnd(game);
        }
    }

    // ─── Round Processing ────────────────────────────────────

    /**
     * Process the end of a round: evaluate feedback, check win, advance round.
     */
    private processRoundEnd(game: GameState): void {
        // Clear round timer
        if (game.roundTimer) {
            clearTimeout(game.roundTimer);
            game.roundTimer = null;
        }

        const p1Id = game.playerOrder[0];
        const p2Id = game.playerOrder[1];
        const p1State = game.players[p1Id];
        const p2State = game.players[p2Id];

        p1State.feedback = evaluateFeedback(p1State.board, game.solution);
        p2State.feedback = evaluateFeedback(p2State.board, game.solution);

        const p1Wins = checkWin(p1State.board, game.solution);
        const p2Wins = checkWin(p2State.board, game.solution);

        if (p1Wins && p2Wins) {
            // Both solved simultaneously — it's a tie, pick p1 as nominal winner
            this.endGame(game, 'tie', 'solved');
            return;
        } else if (p1Wins) {
            this.endGame(game, p1Id, 'solved');
            return;
        } else if (p2Wins) {
            this.endGame(game, p2Id, 'solved');
            return;
        }

        // Advance to next round
        this.advanceRound(game);
    }

    /**
     * Advance to the next round.
     */
    private advanceRound(game: GameState): void {
        game.roundNumber++;
        game.roundDeadline = Date.now() + TURN_DURATION_MS;

        for (const pid of game.playerOrder) {
            const state = game.players[pid];
            state.hasSwapped = false;
            state.moveSubmitted = false;
            state.preSwapBoard = null;
        }

        // Emit round update to both players
        for (const pid of game.playerOrder) {
            const opponentId = game.playerOrder.find((id) => id !== pid)!;
            const myFeedback = game.players[pid].feedback;
            const opponentFeedback = game.players[opponentId].feedback;

            this.emitToPlayer(pid, 'round:update', {
                roundNumber: game.roundNumber,
                roundDeadline: game.roundDeadline,
                roundDuration: TURN_DURATION_MS,
                yourFeedback: myFeedback,
                opponentFeedback: opponentFeedback,
            });
        }

        // Start timer for next round
        this.startRoundTimer(game.gameId);

        // If AI is in the game, schedule its move
        const aiId = game.playerOrder.find(pid => pid.startsWith('ai-'));
        if (aiId) {
            this.scheduleAIMove(game, aiId);
        }
    }

    // ─── Timer ───────────────────────────────────────────────

    /**
     * Start the 15-second round timer. On expiry, auto-submit for anyone who hasn't.
     */
    private startRoundTimer(gameId: string): void {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'playing') return;

        game.roundTimer = setTimeout(() => {
            const g = this.games.get(gameId);
            if (!g || g.status !== 'playing') return;

            let anyoneForced = false;
            for (const pid of g.playerOrder) {
                if (!g.players[pid].moveSubmitted) {
                    g.players[pid].moveSubmitted = true;
                    anyoneForced = true;
                }
            }

            this.processRoundEnd(g);
        }, TURN_DURATION_MS);
    }

    // ─── Game End ────────────────────────────────────────────

    /**
     * End the game with a winner and reason.
     */
    private endGame(game: GameState, winnerId: string, reason: 'solved' | 'forfeit' | 'surrender'): void {
        game.status = 'finished';
        game.winnerId = winnerId;

        if (game.roundTimer) {
            clearTimeout(game.roundTimer);
            game.roundTimer = null;
        }

        const finalBoards: Record<string, BottleColor[]> = {};
        for (const pid of game.playerOrder) {
            finalBoards[pid] = [...game.players[pid].board];
        }

        // Award rewards asynchronously, then emit game:over
        this.awardMatchRewards(game, winnerId, reason).then((rewardsMap) => {
            for (const pid of game.playerOrder) {
                if (pid.startsWith('ai-')) continue;

                this.emitToPlayer(pid, 'game:over', {
                    winnerId,
                    reason,
                    solution: [...game.solution],
                    finalBoards,
                    rewards: rewardsMap[pid],
                });
            }
        });

        // Cleanup after a short delay
        setTimeout(() => this.cleanupGame(game.gameId), 10000);
    }

    /**
     * Award EXP and Gold to both players after a match.
     */
    private async awardMatchRewards(
        game: GameState,
        winnerId: string,
        reason: 'solved' | 'forfeit' | 'surrender'
    ): Promise<Record<string, GameOverRewards>> {
        const rewardsMap: Record<string, GameOverRewards> = {};
        const isAIGame = game.playerOrder.some(pid => pid.startsWith('ai-'));
        const multiplier = isAIGame ? 0.5 : 1;

        for (const pid of game.playerOrder) {
            if (pid.startsWith('ai-')) continue;

            const isWinner = pid === winnerId;
            const isDraw = winnerId === 'draw';
            const isSurrender = reason === 'surrender';
            let expGain: number;
            let goldGain: number;

            if (isDraw) {
                expGain = Math.floor(REWARD_LOSER_EXP * multiplier);
                goldGain = Math.floor(REWARD_LOSER_GOLD * multiplier);
            } else if (isWinner) {
                expGain = Math.floor(REWARD_WINNER_EXP * multiplier);
                goldGain = Math.floor(REWARD_WINNER_GOLD * multiplier);
            } else if (isSurrender) {
                expGain = 0;
                goldGain = 0;
            } else {
                expGain = Math.floor(REWARD_LOSER_EXP * multiplier);
                goldGain = Math.floor(REWARD_LOSER_GOLD * multiplier);
            }

            try {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('exp, gold, level, rp, current_rank, peak_rank, ranked_wins, ranked_losses, highest_rp')
                    .eq('id', pid)
                    .single();

                if (!profile) {
                    rewardsMap[pid] = { exp: expGain, gold: goldGain };
                    continue;
                }

                let newExp = profile.exp + expGain;
                let newGold = profile.gold + goldGain;
                let currentLevel = profile.level;
                let leveledUp = false;

                // Check for level up(s)
                let needed = requiredExpForLevel(currentLevel);
                while (newExp >= needed) {
                    newExp -= needed;
                    currentLevel++;
                    leveledUp = true;
                    needed = requiredExpForLevel(currentLevel);
                }

                // Ranked Points Logic
                let newRp = profile.rp || 0;
                let rpChange = 0;
                let newRank = profile.current_rank || 'Bronze V';
                let rankChanged: 'promoted' | 'demoted' | null = null;
                let rankedWins = profile.ranked_wins || 0;
                let rankedLosses = profile.ranked_losses || 0;

                if (game.isRanked) {
                    rpChange = this.calculateRpChange(newRank, isWinner && !isDraw);
                    newRp = Math.max(0, newRp + rpChange);

                    if (!isDraw) {
                        if (isWinner) rankedWins++;
                        else rankedLosses++;
                    }

                    // Call RPC to get new rank name
                    const { data: rankData } = await supabaseAdmin.rpc('get_rank_from_rp', { rp_val: newRp });
                    newRank = rankData || newRank;

                    if (newRank !== profile.current_rank) {
                        rankChanged = rpChange > 0 ? 'promoted' : 'demoted';
                    }
                }

                await supabaseAdmin
                    .from('profiles')
                    .update({
                        exp: newExp,
                        gold: newGold,
                        level: currentLevel,
                        rp: newRp,
                        current_rank: newRank,
                        ranked_wins: rankedWins,
                        ranked_losses: rankedLosses,
                        peak_rank: (profile.peak_rank && this.getRankWeight(newRank) > this.getRankWeight(profile.peak_rank)) ? newRank : (profile.peak_rank || newRank),
                        highest_rp: Math.max(profile.highest_rp || 0, newRp)
                    })
                    .eq('id', pid);

                rewardsMap[pid] = {
                    exp: expGain,
                    gold: goldGain,
                    leveledUp,
                    newLevel: leveledUp ? currentLevel : undefined,
                    rpChange: game.isRanked ? rpChange : undefined,
                    newRp: game.isRanked ? newRp : undefined,
                    newRank: game.isRanked ? newRank : undefined,
                    rankChanged: game.isRanked ? rankChanged : undefined,
                };
            } catch (err) {
                console.error(`[rewards] Failed to award rewards to ${pid}:`, err);
                rewardsMap[pid] = { exp: expGain, gold: goldGain };
            }
        }

        return rewardsMap;
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
            // Clear AI memory
            if (pid.startsWith('ai-')) {
                cleanupAI(pid);
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
        const opponentPlayer = opponentId ? this.players.get(opponentId) : undefined;

        // Fetch frame for reconnection
        const getFrames = async () => {
            const [me, op] = await Promise.all([
                supabaseAdmin.from('profiles').select('equipped_frame, shop_items!equipped_frame(asset_url)').eq('id', playerId).single(),
                opponentId && !opponentId.startsWith('ai-')
                    ? supabaseAdmin.from('profiles').select('equipped_frame, shop_items!equipped_frame(asset_url)').eq('id', opponentId).single()
                    : Promise.resolve({ data: null })
            ]);
            return {
                myFrame: (me.data as any)?.shop_items?.asset_url || null,
                opFrame: (op.data as any)?.shop_items?.asset_url || null
            };
        };

        getFrames().then(({ myFrame, opFrame }) => {
            this.emitToPlayer(playerId, 'game:start', {
                gameId: game.gameId,
                board: [...playerState.board],
                yourPlayerId: playerId,
                yourFrame: myFrame,
                opponentId: opponentId || '',
                opponentUsername: opponentPlayer?.username || 'Player',
                opponentFrame: opFrame,
                roundDeadline: game.roundDeadline,
                roundDuration: TURN_DURATION_MS,
                roundNumber: game.roundNumber,
                isRanked: game.isRanked,
            });
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

    /** Helper to calculate RP change based on rank and outcome */
    private calculateRpChange(rank: string, isWinner: boolean): number {
        if (isWinner) {
            if (rank.startsWith('Bronze')) return 50;
            if (rank.startsWith('Silver')) return 45;
            if (rank.startsWith('Gold')) return 30;
            if (rank.startsWith('Platinum')) return 30;
            if (rank.startsWith('Diamond')) return 25;
            if (rank.startsWith('Grandmaster')) return 20;
            if (rank.startsWith('Legendary')) return 15;
            return 25;
        } else {
            if (rank.startsWith('Bronze')) return -5;
            if (rank.startsWith('Silver')) return -10;
            if (rank.startsWith('Gold')) return -15;
            if (rank.startsWith('Platinum')) return -20;
            if (rank.startsWith('Diamond')) return -20;
            if (rank.startsWith('Grandmaster')) return -25;
            if (rank.startsWith('Legendary')) return -25;
            return -20;
        }
    }

    /** Helper to compare ranks for peak_rank tracking */
    private getRankWeight(rank: string): number {
        const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Grandmaster', 'Legendary'];
        const subTiers = ['V', 'IV', 'III', 'II', 'I'];

        const tier = tiers.findIndex(t => rank.startsWith(t));
        if (rank === 'Legendary') return 1000;

        const subTierStr = rank.split(' ')[1];
        const subTier = subTiers.indexOf(subTierStr);

        return (tier * 10) + subTier;
    }
}
