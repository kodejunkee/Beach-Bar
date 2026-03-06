import React, { useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { usePathname } from 'expo-router';
import { useGame } from '@/context/GameContext';

const HOME_MUSIC = require('@/assets/audio/home_screen_music.mp3');
const GAME_MUSIC = require('@/assets/audio/game_screen_music.mp3');

export default function BackgroundMusicManager() {
    const pathname = usePathname();
    const { isMuted } = useGame();

    const homePlayer = useAudioPlayer(HOME_MUSIC);
    const gamePlayer = useAudioPlayer(GAME_MUSIC);

    useEffect(() => {
        if (!homePlayer || !gamePlayer) return;

        homePlayer.loop = true;
        gamePlayer.loop = true;

        const currentRoute = pathname === '/' ? 'index' : pathname.replace(/^\//, '');

        homePlayer.volume = isMuted ? 0 : 0.4;
        gamePlayer.volume = isMuted ? 0 : 0.4;

        if (currentRoute === 'game') {
            if (homePlayer.playing) homePlayer.pause();
            if (!gamePlayer.playing) gamePlayer.play();
        } else if (['index', 'shop', 'ranked'].includes(currentRoute)) {
            if (gamePlayer.playing) gamePlayer.pause();
            if (!homePlayer.playing) homePlayer.play();
        } else {
            homePlayer.pause();
            gamePlayer.pause();
        }
    }, [pathname, isMuted, homePlayer, gamePlayer]);

    return null;
}
