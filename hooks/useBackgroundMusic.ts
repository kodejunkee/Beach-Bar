import { useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { useNavigation } from 'expo-router';

/**
 * Plays looping background music while the component is mounted AND focused.
 * Pauses on blur or unmount so each screen can have its own track.
 */
export function useBackgroundMusic(source: number, muted: boolean = false) {
    const player = useAudioPlayer(source);
    const navigation = useNavigation();

    useEffect(() => {
        if (!player) return;

        player.loop = true;
        player.volume = muted ? 0 : 0.4;

        // Listener for when the screen comes into focus
        const unsubscribeFocus = navigation.addListener('focus', () => {
            player.play();
        });

        // Listener for when the screen loses focus (navigating away)
        const unsubscribeBlur = navigation.addListener('blur', () => {
            player.pause();
        });

        // Handle initial play state based on current focus
        if (navigation.isFocused()) {
            player.play();
        }

        return () => {
            unsubscribeFocus();
            unsubscribeBlur();
            player.pause();
        };
    }, [player, muted, navigation]);
}
