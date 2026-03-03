import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PLAYER_ID_KEY = 'mastermind_player_id';

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
