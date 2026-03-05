import http from 'http';
import { Server } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from './types';
import { Matchmaker } from './matchmaker';
import { GameManager } from './gameManager';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// ─── HTTP + Socket.IO Server ───────────────────────────────

const httpServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', game: 'mastermind-online' }));
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
        origin: '*', // Lock down in production
        methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
});

const matchmaker = new Matchmaker();
const gameManager = new GameManager(io);

// ─── Connection Handler ────────────────────────────────────

io.on('connection', (socket) => {
    const playerId = socket.handshake.auth.playerId as string;

    if (!playerId || typeof playerId !== 'string') {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'playerId is required' });
        socket.disconnect(true);
        return;
    }

    console.log(`[connect] ${playerId} (socket: ${socket.id})`);
    gameManager.registerPlayer(playerId, socket.id, 'Player');

    // ─── Quick Match ──────────────────────────────────────

    socket.on('join:quickmatch', async ({ playerId: pid, username }) => {
        if (gameManager.isPlayerInGame(pid)) {
            socket.emit('error', { code: 'ALREADY_IN_GAME', message: 'You are already in a game' });
            return;
        }

        gameManager.registerPlayer(pid, socket.id, username || 'Player');
        const result = matchmaker.joinQuickMatch(pid, socket.id);
        if (result) {
            const p1Player = gameManager.getPlayer(result.player1.playerId);
            const p2Player = gameManager.getPlayer(result.player2.playerId);
            // Match found — create game
            await gameManager.createGame(
                { ...result.player1, username: p1Player?.username || 'Player' },
                { ...result.player2, username: p2Player?.username || 'Player' }
            );
        }
        // else: queued, waiting for opponent
    });

    socket.on('join:ranked', async ({ playerId: pid, username }) => {
        if (gameManager.isPlayerInGame(pid)) {
            socket.emit('error', { code: 'ALREADY_IN_GAME', message: 'You are already in a game' });
            return;
        }

        gameManager.registerPlayer(pid, socket.id, username || 'Player');
        const result = matchmaker.joinRankedMatch(pid, socket.id);
        if (result) {
            const p1Player = gameManager.getPlayer(result.player1.playerId);
            const p2Player = gameManager.getPlayer(result.player2.playerId);
            // Match found — create game
            await gameManager.createGame(
                { ...result.player1, username: p1Player?.username || 'Player' },
                { ...result.player2, username: p2Player?.username || 'Player' },
                true // isRanked
            );
        }
        // else: queued, waiting for opponent
    });

    socket.on('quickmatch:leave', ({ playerId: pid }) => {
        matchmaker.leaveQuickMatch(pid);
        matchmaker.leaveRankedMatch(pid);
        socket.emit('quickmatch:cancelled');
    });

    // ─── Private Lobby ────────────────────────────────────

    socket.on('lobby:create', ({ playerId: pid, username }) => {
        if (gameManager.isPlayerInGame(pid)) {
            socket.emit('error', { code: 'ALREADY_IN_GAME', message: 'You are already in a game' });
            return;
        }

        gameManager.registerPlayer(pid, socket.id, username || 'Player');
        const lobby = matchmaker.createLobby(pid);
        socket.emit('lobby:created', { lobbyId: lobby.lobbyId, code: lobby.code });

        // Set up expiry notification
        const checkExpiry = setInterval(() => {
            const l = matchmaker.getLobby(lobby.code);
            if (!l || l.status === 'expired') {
                socket.emit('lobby:expired');
                clearInterval(checkExpiry);
            } else if (l.status === 'full') {
                clearInterval(checkExpiry);
            }
        }, 1000);
    });

    socket.on('lobby:join', async ({ playerId: pid, username, code }) => {
        if (gameManager.isPlayerInGame(pid)) {
            socket.emit('error', { code: 'ALREADY_IN_GAME', message: 'You are already in a game' });
            return;
        }

        gameManager.registerPlayer(pid, socket.id, username || 'Player');
        const result = matchmaker.joinLobby(pid, code);

        if ('error' in result) {
            socket.emit('error', { code: result.errorCode, message: result.error });
            return;
        }

        const lobby = result.lobby;

        // Notify both players
        const hostPlayer = gameManager.getPlayer(lobby.hostPlayerId);
        if (hostPlayer) {
            io.to(hostPlayer.socketId).emit('lobby:joined', { opponentJoined: true });
        }
        socket.emit('lobby:joined', { opponentJoined: true });

        // Create the game
        if (hostPlayer && lobby.guestPlayerId) {
            await gameManager.createGame(
                { playerId: lobby.hostPlayerId, socketId: hostPlayer.socketId, username: hostPlayer.username },
                { playerId: lobby.guestPlayerId, socketId: socket.id, username: username || 'Player' },
                false // isRanked
            );
            matchmaker.destroyLobby(lobby.code);
        }
    });

    socket.on('lobby:leave', ({ playerId: pid }) => {
        matchmaker.leaveLobby(pid);
        socket.emit('lobby:cancelled');
    });

    // ─── AI Game ──────────────────────────────────────────

    socket.on('join:ai', async ({ playerId: pid, username }) => {
        if (gameManager.isPlayerInGame(pid)) {
            socket.emit('error', { code: 'ALREADY_IN_GAME', message: 'You are already in a game' });
            return;
        }

        gameManager.registerPlayer(pid, socket.id, username || 'Player');
        await gameManager.createAIGame({
            playerId: pid,
            socketId: socket.id,
            username: username || 'Player',
        });
    });

    // ─── Game Moves ───────────────────────────────────────

    socket.on('move:swap', ({ index1, index2 }) => {
        gameManager.handleSwap(playerId, index1, index2);
    });

    socket.on('move:undo', () => {
        gameManager.handleUndo(playerId);
    });

    socket.on('turn:submit', () => {
        gameManager.handleSubmit(playerId);
    });

    // ─── Surrender ────────────────────────────────────────

    socket.on('game:surrender', ({ playerId: pid }) => {
        gameManager.handleSurrender(pid);
    });

    // ─── Reconnect ────────────────────────────────────────

    socket.on('reconnect:game', ({ playerId: pid, gameId }) => {
        gameManager.handleReconnect(pid, gameId, socket.id);
    });

    // ─── Disconnect ───────────────────────────────────────

    socket.on('disconnect', () => {
        console.log(`[disconnect] ${playerId} (socket: ${socket.id})`);
        matchmaker.handleDisconnect(playerId);
        gameManager.handleDisconnect(playerId);
    });
});

// ─── Start Server ──────────────────────────────────────────

httpServer.listen(PORT, () => {
    console.log(`🎮 Mastermind Online server running on port ${PORT}`);
});
