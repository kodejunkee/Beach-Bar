import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ImageBackground, Image } from 'react-native';
import { router } from 'expo-router';
import { useGame } from '@/context/GameContext';
import Board from '@/components/Board';
import TurnTimer from '@/components/TurnTimer';
import FeedbackDisplay from '@/components/FeedbackDisplay';
import GameStatusBar from '@/components/StatusBar';
import ResultsModal from '@/components/ResultsModal';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';

const GAME_BG = require('@/assets/images/backgrounds/game screen beach background.png');
const ICON_CHECKMARK = require('@/assets/images/UI/icons/submit.png');
const ICON_SKIP = require('@/assets/images/UI/icons/skip.png');
const ICON_UNDO = require('@/assets/images/UI/icons/undo.png');
const GAME_MUSIC = require('@/assets/audio/game screen music.mp3');

export default function GameScreen() {
    const [hasSwapped, setHasSwapped] = useState(false);

    useBackgroundMusic(GAME_MUSIC);

    const {
        phase,
        playerId,
        board,
        activePlayerId,
        turnNumber,
        turnDeadline,
        turnDuration,
        myFeedback,
        opponentFeedback,
        opponentConnected,
        gameOver,
        sendSwap,
        undoMove,
        submitTurn,
        surrender,
        resetToHome,
    } = useGame();

    // Reset swap state on each new turn
    useEffect(() => {
        setHasSwapped(false);
    }, [activePlayerId, turnNumber]);

    // If navigated here but no game, go home
    useEffect(() => {
        if (phase === 'home') {
            router.replace('/');
        }
    }, [phase]);

    const isMyTurn = activePlayerId === playerId;

    const handleSwap = useCallback(
        (index1: number, index2: number) => {
            if (!isMyTurn || hasSwapped) return;
            sendSwap(index1, index2);
            setHasSwapped(true);
        },
        [isMyTurn, hasSwapped, sendSwap]
    );

    const handleSubmit = useCallback(() => {
        if (!isMyTurn) return;
        submitTurn();
    }, [isMyTurn, submitTurn]);

    const handleUndo = useCallback(() => {
        if (!isMyTurn || !hasSwapped) return;
        undoMove();
        setHasSwapped(false);
    }, [isMyTurn, hasSwapped, undoMove]);

    const handlePlayAgain = useCallback(() => {
        resetToHome();
        router.replace('/');
    }, [resetToHome]);

    const handleSurrender = useCallback(() => {
        Alert.alert(
            'Surrender?',
            'Your opponent will win the match. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Surrender', style: 'destructive', onPress: surrender },
            ]
        );
    }, [surrender]);

    if (board.length === 0) {
        return (
            <ImageBackground source={GAME_BG} style={styles.bg} resizeMode="cover">
                <View style={styles.overlay}>
                    <Text style={styles.loadingText}>Loading…</Text>
                </View>
            </ImageBackground>
        );
    }

    return (
        <ImageBackground source={GAME_BG} style={styles.bg} resizeMode="cover">
            {/* Dark overlay for readability */}
            <View style={styles.overlay}>
                {/* Surrender button - top left */}
                <View style={styles.topRow}>
                    <TouchableOpacity style={styles.surrenderButton} onPress={handleSurrender} activeOpacity={0.8}>
                        <Text style={styles.surrenderText}>🏳 Surrender</Text>
                    </TouchableOpacity>
                </View>

                {/* Status Bar */}
                <GameStatusBar
                    isMyTurn={isMyTurn}
                    opponentConnected={opponentConnected}
                    turnNumber={turnNumber}
                />

                {/* Timer */}
                <TurnTimer turnDeadline={turnDeadline} turnDuration={turnDuration} isMyTurn={isMyTurn} />

                {/* Board */}
                <View style={styles.boardSection}>
                    <Board
                        bottles={board}
                        disabled={!isMyTurn}
                        hasSwapped={hasSwapped}
                        onSwap={handleSwap}
                    />
                    {isMyTurn && !hasSwapped && (
                        <Text style={styles.hint}>Tap two bottles to swap them</Text>
                    )}
                    {isMyTurn && hasSwapped && (
                        <Text style={styles.hintDone}>Swap made! Submit or wait for the timer.</Text>
                    )}
                    {!isMyTurn && (
                        <Text style={styles.hint}>Waiting for opponent…</Text>
                    )}
                </View>

                {/* Feedback */}
                <FeedbackDisplay
                    myFeedback={myFeedback}
                    opponentFeedback={opponentFeedback}
                />

                {/* Action Buttons */}
                <View style={styles.actionArea}>
                    {/* Undo Move */}
                    <TouchableOpacity
                        style={[(!isMyTurn || !hasSwapped) && styles.actionBtnDisabled]}
                        onPress={handleUndo}
                        disabled={!isMyTurn || !hasSwapped}
                        activeOpacity={0.8}
                    >
                        <Image source={ICON_UNDO} style={styles.actionIcon} resizeMode="contain" />
                    </TouchableOpacity>

                    {/* Skip Turn */}
                    <TouchableOpacity
                        style={[(!isMyTurn || hasSwapped) && styles.actionBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={!isMyTurn || hasSwapped}
                        activeOpacity={0.8}
                    >
                        <Image source={ICON_SKIP} style={styles.actionIcon} resizeMode="contain" />
                    </TouchableOpacity>

                    {/* Submit Move */}
                    <TouchableOpacity
                        style={[(!isMyTurn || !hasSwapped) && styles.actionBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={!isMyTurn || !hasSwapped}
                        activeOpacity={0.8}
                    >
                        <Image source={ICON_CHECKMARK} style={styles.actionIcon} resizeMode="contain" />
                    </TouchableOpacity>
                </View>

                {/* Results */}
                {gameOver && (
                    <ResultsModal
                        visible={true}
                        winnerId={gameOver.winnerId}
                        myPlayerId={playerId}
                        reason={gameOver.reason}
                        solution={gameOver.solution}
                        onPlayAgain={handlePlayAgain}
                    />
                )}
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    bg: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 10, 20, 0.52)',
        paddingTop: 50,
    },
    topRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 2,
    },
    surrenderButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#3A2A2E',
        backgroundColor: '#1A1215',
    },
    surrenderText: {
        color: '#E74C3C',
        fontSize: 13,
        fontWeight: '600',
    },
    loadingText: {
        color: '#8E8EA0',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 100,
    },
    boardSection: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    hint: {
        color: '#5A5A72',
        fontSize: 13,
        marginTop: 8,
        fontWeight: '500',
    },
    hintDone: {
        color: '#2ECC71',
        fontSize: 13,
        marginTop: 8,
        fontWeight: '600',
    },
    actionArea: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingBottom: 40,
    },
    actionBtnDisabled: {
        opacity: 0.3,
    },
    actionIcon: {
        width: 84,
        height: 84,
    },
});
