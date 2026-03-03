import { v4 as uuidv4 } from 'uuid';
import { Lobby, LOBBY_EXPIRY_MS } from './types';

// Characters that avoid ambiguity (no 0/O, 1/I/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Manages quick-match queue and private lobbies.
 */
export class Matchmaker {
    /** Queue of playerIds waiting for random match */
    private quickQueue: { playerId: string; socketId: string }[] = [];
    /** Active lobbies keyed by lobby code */
    private lobbies: Map<string, Lobby> = new Map();
    /** Reverse lookup: playerId → lobby code */
    private playerLobbyMap: Map<string, string> = new Map();

    // ─── Quick Match ─────────────────────────────────────────

    /**
     * Add a player to the quick-match queue.
     * Returns a pair [player1, player2] if a match is made, or null if queued.
     */
    joinQuickMatch(
        playerId: string,
        socketId: string
    ): { player1: { playerId: string; socketId: string }; player2: { playerId: string; socketId: string } } | null {
        // Don't double-queue
        const alreadyQueued = this.quickQueue.find((p) => p.playerId === playerId);
        if (alreadyQueued) return null;

        // Try to match with a waiting player
        if (this.quickQueue.length > 0) {
            const opponent = this.quickQueue.shift()!;
            return { player1: opponent, player2: { playerId, socketId } };
        }

        // No one waiting — queue this player
        this.quickQueue.push({ playerId, socketId });
        return null;
    }

    /** Remove a player from the quick-match queue (e.g. on disconnect). */
    leaveQuickMatch(playerId: string): void {
        this.quickQueue = this.quickQueue.filter((p) => p.playerId !== playerId);
    }

    // ─── Private Lobbies ─────────────────────────────────────

    /** Generate a collision-free lobby code. */
    private generateCode(): string {
        let code: string;
        do {
            code = '';
            for (let i = 0; i < CODE_LENGTH; i++) {
                code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
            }
        } while (this.lobbies.has(code));
        return code;
    }

    /**
     * Create a private lobby. Returns the Lobby object.
     */
    createLobby(hostPlayerId: string): Lobby {
        // Clean up any existing lobby this player hosts
        const existingCode = this.playerLobbyMap.get(hostPlayerId);
        if (existingCode) {
            this.destroyLobby(existingCode);
        }

        const code = this.generateCode();
        const lobby: Lobby = {
            lobbyId: uuidv4(),
            code,
            hostPlayerId,
            guestPlayerId: null,
            status: 'waiting',
            createdAt: Date.now(),
            expiryTimer: setTimeout(() => {
                this.expireLobby(code);
            }, LOBBY_EXPIRY_MS),
        };

        this.lobbies.set(code, lobby);
        this.playerLobbyMap.set(hostPlayerId, code);
        return lobby;
    }

    /**
     * Join an existing lobby by code.
     * Returns the Lobby if successful, or an error string.
     */
    joinLobby(
        guestPlayerId: string,
        code: string
    ): { lobby: Lobby } | { error: string; errorCode: string } {
        const upperCode = code.toUpperCase().trim();
        const lobby = this.lobbies.get(upperCode);

        if (!lobby || lobby.status === 'expired') {
            return { error: 'Lobby not found or expired', errorCode: 'LOBBY_NOT_FOUND' };
        }
        if (lobby.status === 'full') {
            return { error: 'Lobby is already full', errorCode: 'LOBBY_FULL' };
        }
        if (lobby.hostPlayerId === guestPlayerId) {
            return { error: 'Cannot join your own lobby', errorCode: 'LOBBY_SELF_JOIN' };
        }

        // Fill the lobby
        lobby.guestPlayerId = guestPlayerId;
        lobby.status = 'full';
        if (lobby.expiryTimer) {
            clearTimeout(lobby.expiryTimer);
            lobby.expiryTimer = null;
        }
        this.playerLobbyMap.set(guestPlayerId, upperCode);

        return { lobby };
    }

    /** Expire a lobby (called by timer). */
    private expireLobby(code: string): void {
        const lobby = this.lobbies.get(code);
        if (lobby && lobby.status === 'waiting') {
            lobby.status = 'expired';
            if (lobby.expiryTimer) {
                clearTimeout(lobby.expiryTimer);
                lobby.expiryTimer = null;
            }
            // Callback will be handled by game manager via polling or event
        }
    }

    /** Destroy/cleanup a lobby. */
    destroyLobby(code: string): void {
        const lobby = this.lobbies.get(code);
        if (lobby) {
            if (lobby.expiryTimer) clearTimeout(lobby.expiryTimer);
            this.playerLobbyMap.delete(lobby.hostPlayerId);
            if (lobby.guestPlayerId) this.playerLobbyMap.delete(lobby.guestPlayerId);
            this.lobbies.delete(code);
        }
    }

    /** Get a lobby by code. */
    getLobby(code: string): Lobby | undefined {
        return this.lobbies.get(code.toUpperCase().trim());
    }

    /** Get lobby code for a player. */
    getPlayerLobbyCode(playerId: string): string | undefined {
        return this.playerLobbyMap.get(playerId);
    }

    /**
     * Explicit lobby cancellation by the host before any guest joins.
     * Returns the lobby code if found, otherwise null.
     */
    leaveLobby(playerId: string): string | null {
        const code = this.playerLobbyMap.get(playerId);
        if (!code) return null;
        const lobby = this.lobbies.get(code);
        if (lobby && lobby.status === 'waiting') {
            this.destroyLobby(code);
            return code;
        }
        return null;
    }

    /** Remove a player from queue and any lobby on disconnect. */
    handleDisconnect(playerId: string): { lobbyCode?: string; wasHost: boolean } {
        this.leaveQuickMatch(playerId);

        const code = this.playerLobbyMap.get(playerId);
        if (code) {
            const lobby = this.lobbies.get(code);
            if (lobby && lobby.status === 'waiting') {
                this.destroyLobby(code);
                return { lobbyCode: code, wasHost: true };
            }
        }

        return { wasHost: false };
    }
}
