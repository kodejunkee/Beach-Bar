import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PLAYER_ID_KEY = 'mastermind_player_id';
const USERNAME_KEY = 'beachbar_username';
const DEFAULT_USERNAME = 'Player';

/**
 * Get or create a persistent anonymous player ID.
 * Stored in AsyncStorage so it survives app restarts.
 */
export async function getOrCreatePlayerId(): Promise<string> {
    try {
        let id = await AsyncStorage.getItem(PLAYER_ID_KEY);
        if (!id) {
            id = Crypto.randomUUID();
            await AsyncStorage.setItem(PLAYER_ID_KEY, id);
        }
        return id;
    } catch {
        // Fallback if AsyncStorage fails
        return Crypto.randomUUID();
    }
}

/**
 * Get the player's display username.
 */
export async function getUsername(): Promise<string> {
    try {
        const name = await AsyncStorage.getItem(USERNAME_KEY);
        return name || DEFAULT_USERNAME;
    } catch {
        return DEFAULT_USERNAME;
    }
}

/**
 * Set the player's display username (max 15 chars).
 */
export async function setUsername(name: string): Promise<void> {
    const trimmed = name.trim().slice(0, 15) || DEFAULT_USERNAME;
    await AsyncStorage.setItem(USERNAME_KEY, trimmed);
}
