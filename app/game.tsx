import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ImageBackground, Image, Animated, Easing } from 'react-native';
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
const ICON_SETTINGS = require('@/assets/images/UI/icons/settings.png');
const GAME_MUSIC = require('@/assets/audio/game screen music.mp3');

export default function GameScreen() {
    const [hasSwapped, setHasSwapped] = useState(false);

    useBackgroundMusic(GAME_MUSIC);

    const {
        phase,
        playerId,
        myUsername,
        opponentUsername,
        board,
        roundNumber,
        roundDeadline,
        myMoveSubmitted,
        opponentSubmitted,
        myFeedback,
        opponentFeedback,
        opponentConnected,
        gameOver,
        sendSwap,
        undoMove,
        submitTurn,
        surrender,
        resetToHome,
        clearError,
        myEquippedFrame,
        opponentEquippedFrame,
    } = useGame();

    const [showSettings, setShowSettings] = useState(false);
    const settingsAnim = useRef(new Animated.Value(0)).current;

    const toggleSettings = (show: boolean) => {
        if (show) {
            setShowSettings(true);
            Animated.spring(settingsAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 65,
                friction: 10,
            }).start();
        } else {
            Animated.timing(settingsAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
                easing: Easing.in(Easing.ease),
            }).start(() => setShowSettings(false));
        }
    };

    // Reset swap state on each new round
    useEffect(() => {
        setHasSwapped(false);
    }, [roundNumber]);

    // If navigated here but no game, go home
    useEffect(() => {
        if (phase === 'home') {
            router.replace('/');
        }
    }, [phase]);

    // Players can interact as long as they haven't submitted their move for the round
    const canInteract = !myMoveSubmitted;

    const handleSwap = useCallback(
        (index1: number, index2: number) => {
            if (!canInteract || hasSwapped) return;
            sendSwap(index1, index2);
            setHasSwapped(true);
        },
        [canInteract, hasSwapped, sendSwap]
    );

    const handleSubmit = useCallback(() => {
        if (!canInteract) return;
        submitTurn();
    }, [canInteract, submitTurn]);

    const handleUndo = useCallback(() => {
        if (!canInteract || !hasSwapped) return;
        undoMove();
        setHasSwapped(false);
    }, [canInteract, hasSwapped, undoMove]);

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

    // Determine Hint Text
    let hintText = '';
    if (!hasSwapped && !myMoveSubmitted) {
        hintText = opponentSubmitted ? "Opponent is ready! Make your move before time runs out!" : `Round ${roundNumber}: Tap two bottles to swap`;
    } else if (hasSwapped && !myMoveSubmitted) {
        hintText = "Swap matched! Submit your round.";
    } else if (myMoveSubmitted && !opponentSubmitted) {
        hintText = "Waiting for opponent to finish...";
    } else if (myMoveSubmitted && opponentSubmitted) {
        hintText = "Evaluating boards...";
    }

    return (
        <ImageBackground source={GAME_BG} style={styles.bg} resizeMode="cover">
            {/* Dark overlay for readability */}
            <View style={styles.overlay}>
                {/* Settings button - top right */}
                <View style={styles.topRow}>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity style={styles.settingsBtn} onPress={() => toggleSettings(true)} activeOpacity={0.7}>
                        <Image source={ICON_SETTINGS} style={styles.settingsIcon} />
                    </TouchableOpacity>
                </View>

                {/* Player name - ABOVE StatusBar */}
                <View style={styles.playerNameRow}>
                    <View style={styles.profileBadge}>
                        <View style={styles.profileIconContainer}>
                            {myEquippedFrame && (
                                <Text style={styles.equippedFrame}>{myEquippedFrame}</Text>
                            )}
                            <View style={styles.profileIconPlaceholder}>
                                <Text style={styles.profileIconText}>{myUsername.charAt(0).toUpperCase()}</Text>
                            </View>
                        </View>
                        <Text style={styles.playerNameText} numberOfLines={1}>{myUsername}</Text>
                    </View>
                </View>

                {/* Status Bar */}
                <GameStatusBar
                    roundNumber={roundNumber}
                    opponentConnected={opponentConnected}
                />

                {/* Opponent name - BELOW StatusBar */}
                <View style={styles.opponentNameRow}>
                    <Text style={styles.opponentNameText} numberOfLines={1}>{opponentUsername}</Text>
                    <View style={styles.profileIconContainer}>
                        {opponentEquippedFrame && (
                            <Text style={styles.equippedFrame}>{opponentEquippedFrame}</Text>
                        )}
                        <View style={styles.profileIconPlaceholder}>
                            <Text style={styles.profileIconText}>{opponentUsername.charAt(0).toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                {/* Timer (15 seconds) */}
                <TurnTimer turnDeadline={roundDeadline} turnDuration={15000} isMyTurn={canInteract} />

                {/* Board */}
                <View style={styles.boardSection}>
                    <Board
                        bottles={board}
                        disabled={!canInteract}
                        hasSwapped={hasSwapped}
                        onSwap={handleSwap}
                    />

                    <Text style={[
                        styles.hint,
                        (hasSwapped && !myMoveSubmitted) && styles.hintDone,
                        (opponentSubmitted && !myMoveSubmitted) && styles.hintUrgent
                    ]}>
                        {hintText}
                    </Text>
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
                        style={[(!canInteract || !hasSwapped) && styles.actionBtnDisabled]}
                        onPress={handleUndo}
                        disabled={!canInteract || !hasSwapped}
                        activeOpacity={0.8}
                    >
                        <Image source={ICON_UNDO} style={styles.actionIcon} resizeMode="contain" />
                    </TouchableOpacity>

                    {/* Skip Turn -> Instead acting as an empty submit if not swapped, or submit if already early? 
                        Let's keep it as is, if not swapped, skip is available to submit early. */}
                    <TouchableOpacity
                        style={[(!canInteract || hasSwapped) && styles.actionBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={!canInteract || hasSwapped}
                        activeOpacity={0.8}
                    >
                        <Image source={ICON_SKIP} style={styles.actionIcon} resizeMode="contain" />
                    </TouchableOpacity>

                    {/* Submit Move */}
                    <TouchableOpacity
                        style={[(!canInteract || !hasSwapped) && styles.actionBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={!canInteract || !hasSwapped}
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

                {/* In-game Settings Panel */}
                {showSettings && (
                    <>
                        <TouchableOpacity
                            style={styles.settingsOverlay}
                            activeOpacity={1}
                            onPress={() => toggleSettings(false)}
                        />
                        <Animated.View
                            style={[
                                styles.settingsPanel,
                                {
                                    opacity: settingsAnim,
                                    transform: [{
                                        translateY: settingsAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [-40, 0],
                                        }),
                                    }],
                                },
                            ]}
                        >
                            <View style={styles.settingsCard}>
                                <Text style={styles.settingsTitle}>⚙ Settings</Text>
                                <TouchableOpacity
                                    style={styles.settingsOption}
                                    onPress={() => {
                                        toggleSettings(false);
                                        handleSurrender();
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.surrenderText}>🏳 Surrender</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.settingsCloseBtn}
                                    onPress={() => toggleSettings(false)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.settingsCloseText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </>
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
    settingsBtn: {
        padding: 4,
    },
    settingsIcon: {
        width: 40,
        height: 40,
    },
    playerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    opponentNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
    },
    profileBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileIconContainer: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    equippedFrame: {
        position: 'absolute',
        fontSize: 56,
        zIndex: 0,
    },
    profileIconPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        zIndex: 1,
    },
    profileIconText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    playerNameText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    opponentNameText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 10,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
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
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    hintDone: {
        color: '#2ECC71',
        fontWeight: '600',
    },
    hintUrgent: {
        color: '#E74C3C',
        fontWeight: '700',
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
    // In-game settings panel
    settingsOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 15,
    },
    settingsPanel: {
        position: 'absolute',
        top: 55,
        right: 16,
        zIndex: 20,
        width: 200,
    },
    settingsCard: {
        backgroundColor: '#1A1A2E',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    settingsTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    settingsOption: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: 'rgba(231, 76, 60, 0.15)',
        alignItems: 'center',
    },
    surrenderText: {
        color: '#E74C3C',
        fontSize: 14,
        fontWeight: '700',
    },
    settingsCloseBtn: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    settingsCloseText: {
        color: '#8E8EA0',
        fontSize: 13,
        fontWeight: '600',
    },
});
