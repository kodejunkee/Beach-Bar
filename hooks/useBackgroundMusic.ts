import { useEffect, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';

/**
 * Plays looping background music while the component is mounted.
 * Pauses on unmount so each screen can have its own track.
 */
export function useBackgroundMusic(source: number) {
    const player = useAudioPlayer(source);
    const started = useRef(false);

    useEffect(() => {
        if (!player) return;

        player.loop = true;
        player.volume = 0.4;

        if (!started.current) {
            player.play();
            started.current = true;
        }

        return () => {
            player.pause();
        };
    }, [player]);
}
