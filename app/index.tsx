import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ImageBackground,
    Image,
    Animated,
    Easing,
    Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useGame } from '@/context/GameContext';
import * as Clipboard from 'expo-clipboard';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';

const MAIN_BG = require('@/assets/images/backgrounds/main screen background.png');
const HOME_MUSIC = require('@/assets/audio/home screen music.mp3');

// UI button assets
const BTN_QUICK_MATCH = require('@/assets/images/UI/buttons/Quick Match.png');
const BTN_CREATE_LOBBY = require('@/assets/images/UI/buttons/Create Private Lobby.png');
const BTN_JOIN_LOBBY = require('@/assets/images/UI/buttons/Join a Lobby.png');
const BTN_CANCEL = require('@/assets/images/UI/buttons/cancel.png');
const IMG_TITLE = require('@/assets/images/UI/banners/beach bar title.png');
const ICON_SETTINGS = require('@/assets/images/UI/icons/settings.png');
const ICON_MUTE = require('@/assets/images/UI/icons/mute.png');
const ICON_UNMUTE = require('@/assets/images/UI/icons/unmute.png');

export default function HomeScreen() {
    const [lobbyInput, setLobbyInput] = useState('');
    const [showJoinInput, setShowJoinInput] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [copied, setCopied] = useState(false);

    useBackgroundMusic(HOME_MUSIC);
    const [lobbyCountdown, setLobbyCountdown] = useState(300);
    const lobbyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const {
        connected,
        phase,
        lobbyCode,
        gameId,
        error,
        joinQuickMatch,
        cancelQuickMatch,
        createLobby,
        cancelLobby,
        joinLobby,
        clearError,
        hasPlayedIntro,
        setHasPlayedIntro,
    } = useGame();

    // ─── Animations ─────────────────────────────────────────
    const titleY = useRef(new Animated.Value(hasPlayedIntro ? 0 : -200)).current;
    const btnOpacity = useRef(new Animated.Value(hasPlayedIntro ? 1 : 0)).current;
    const btnScale = useRef(new Animated.Value(hasPlayedIntro ? 1 : 0.8)).current;

    useEffect(() => {
        if (!hasPlayedIntro) {
            Animated.sequence([
                // 1. Title drops down with a spring bounce
                Animated.spring(titleY, {
                    toValue: 0,
                    friction: 5,
                    tension: 40,
                    useNativeDriver: true,
                }),
                // 2. Buttons fade and scale in smoothly
                Animated.parallel([
                    Animated.timing(btnOpacity, {
                        toValue: 1,
                        duration: 300,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(btnScale, {
                        toValue: 1,
                        duration: 300,
                        easing: Easing.out(Easing.back(1.5)), // elegant slight pop
                        useNativeDriver: true,
                    }),
                ])
            ]).start(() => setHasPlayedIntro(true));
        }
    }, [hasPlayedIntro, setHasPlayedIntro, btnOpacity, btnScale, titleY]);

    // Navigate to game when match starts
    useEffect(() => {
        if (phase === 'playing' && gameId) {
            router.push('/game');
        }
    }, [phase, gameId]);

    // Lobby countdown timer
    useEffect(() => {
        if (phase === 'lobby') {
            setLobbyCountdown(300);
            lobbyTimerRef.current = setInterval(() => {
                setLobbyCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(lobbyTimerRef.current!);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (lobbyTimerRef.current) {
                clearInterval(lobbyTimerRef.current);
                lobbyTimerRef.current = null;
            }
        }
        return () => {
            if (lobbyTimerRef.current) clearInterval(lobbyTimerRef.current);
        };
    }, [phase]);

    const handleJoinLobby = () => {
        const code = lobbyInput.trim().toUpperCase();
        if (code.length === 6) {
            joinLobby(code);
        }
    };

    return (
        <ImageBackground source={MAIN_BG} style={styles.bg} resizeMode="cover">
            <View style={styles.bgOverlay}>
                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Settings Button */}
                    <TouchableOpacity
                        style={styles.settingsBtn}
                        onPress={() => setShowSettings(true)}
                        activeOpacity={0.7}
                    >
                        <Image source={ICON_SETTINGS} style={styles.settingsIcon} />
                    </TouchableOpacity>

                    {/* Title */}
                    <Animated.View style={[styles.header, { transform: [{ translateY: titleY }] }]}>
                        <Image source={IMG_TITLE} style={styles.titleImg} resizeMode="contain" />
                    </Animated.View>

                    {/* Connection Status */}
                    {!connected && (
                        <View style={styles.connectingBar}>
                            <ActivityIndicator size="small" color="#F1C40F" />
                            <Text style={styles.connectingText}>Connecting…</Text>
                        </View>
                    )}

                    {/* Error Display */}
                    {error && (
                        <TouchableOpacity style={styles.errorBar} onPress={clearError}>
                            <Text style={styles.errorText}>{error.message}</Text>
                            <Text style={styles.errorDismiss}>Tap to dismiss</Text>
                        </TouchableOpacity>
                    )}

                    {/* Matchmaking in progress */}
                    {phase === 'matchmaking' && (
                        <View style={styles.waitingCard}>
                            <ActivityIndicator size="large" color="#6C5CE7" />
                            <Text style={styles.waitingText}>Finding opponent…</Text>
                            <TouchableOpacity onPress={cancelQuickMatch} activeOpacity={0.7}>
                                <Image source={BTN_CANCEL} style={styles.imgBtnSmall} resizeMode="contain" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Lobby waiting */}
                    {phase === 'lobby' && lobbyCode && (
                        <View style={styles.lobbyCard}>
                            <Text style={styles.lobbyLabel}>LOBBY CODE</Text>
                            <View style={styles.codeRow}>
                                <Text style={styles.lobbyCode}>{lobbyCode}</Text>
                                <TouchableOpacity
                                    onPress={async () => {
                                        await Clipboard.setStringAsync(lobbyCode);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                    activeOpacity={0.6}
                                    style={styles.copyBtn}
                                >
                                    <Text style={styles.copyBtnText}>{copied ? '✓' : '📋'}</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.lobbyHint}>
                                {copied ? 'Copied to clipboard!' : 'Share this code with a friend'}
                            </Text>
                            <ActivityIndicator size="small" color="#8E8EA0" style={{ marginTop: 12 }} />
                            <Text style={styles.waitingText}>Waiting for opponent…</Text>
                            <Text style={styles.lobbyExpiry}>
                                Expires in {String(Math.floor(lobbyCountdown / 60)).padStart(2, '0')}:{String(lobbyCountdown % 60).padStart(2, '0')}
                            </Text>
                            <TouchableOpacity onPress={cancelLobby} activeOpacity={0.7}>
                                <Image source={BTN_CANCEL} style={styles.imgBtnSmall} resizeMode="contain" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Action Buttons */}
                    {(phase === 'home') && (
                        <Animated.View
                            style={[
                                styles.actions,
                                {
                                    opacity: btnOpacity,
                                    transform: [{ scale: btnScale }]
                                }
                            ]}
                        >
                            <TouchableOpacity
                                onPress={joinQuickMatch}
                                disabled={!connected}
                                activeOpacity={0.7}
                                style={!connected && styles.btnDisabled}
                            >
                                <Image source={BTN_QUICK_MATCH} style={styles.imgBtn} resizeMode="contain" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={createLobby}
                                disabled={!connected}
                                activeOpacity={0.7}
                                style={!connected && styles.btnDisabled}
                            >
                                <Image source={BTN_CREATE_LOBBY} style={styles.imgBtn} resizeMode="contain" />
                            </TouchableOpacity>

                            {!showJoinInput ? (
                                <TouchableOpacity
                                    onPress={() => setShowJoinInput(true)}
                                    disabled={!connected}
                                    activeOpacity={0.7}
                                    style={!connected && styles.btnDisabled}
                                >
                                    <Image source={BTN_JOIN_LOBBY} style={styles.imgBtn} resizeMode="contain" />
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.joinRow}>
                                    <TextInput
                                        style={styles.codeInput}
                                        value={lobbyInput}
                                        onChangeText={setLobbyInput}
                                        placeholder="ENTER CODE"
                                        placeholderTextColor="#5A5A72"
                                        maxLength={6}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                    />
                                    {lobbyInput.trim().length === 0 ? (
                                        <TouchableOpacity
                                            style={styles.cancelButton}
                                            onPress={() => { setShowJoinInput(false); setLobbyInput(''); }}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.joinButtonText}>CANCEL</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.joinButton, lobbyInput.trim().length < 6 && styles.joinButtonDisabled]}
                                            onPress={handleJoinLobby}
                                            disabled={lobbyInput.trim().length < 6}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.joinButtonText}>JOIN</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </Animated.View>
                    )}

                    <Text style={styles.version}>v1.0.0</Text>
                </KeyboardAvoidingView>

                {/* Settings Modal */}
                <Modal
                    visible={showSettings}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowSettings(false)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowSettings(false)}
                    >
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>Settings</Text>

                            <TouchableOpacity
                                style={styles.muteRow}
                                onPress={() => setIsMuted(prev => !prev)}
                                activeOpacity={0.7}
                            >
                                <Image
                                    source={isMuted ? ICON_MUTE : ICON_UNMUTE}
                                    style={styles.muteIcon}
                                />
                                <Text style={styles.muteLabel}>
                                    {isMuted ? 'Sound Off' : 'Sound On'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setShowSettings(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.modalCloseBtnText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    bg: {
        flex: 1,
    },
    bgOverlay: {
        flex: 1,
        backgroundColor: 'rgba(8, 8, 22, 0.48)',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    settingsBtn: {
        position: 'absolute',
        top: 60, // Account for safe area
        right: 24,
        zIndex: 10,
    },
    settingsIcon: {
        width: 64,
        height: 64,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    titleImg: {
        width: 540,     // +30% from 416
        height: 236,    // +30% from 182
        marginBottom: -24,
    },
    connectingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    connectingText: {
        color: '#F1C40F',
        fontSize: 14,
    },
    errorBar: {
        backgroundColor: 'rgba(231, 76, 60, 0.2)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
        marginBottom: 16,
        alignItems: 'center',
    },
    errorText: {
        color: '#E74C3C',
        fontSize: 14,
        fontWeight: '600',
    },
    errorDismiss: {
        color: '#8E8EA0',
        fontSize: 11,
        marginTop: 2,
    },
    waitingCard: {
        alignItems: 'center',
        gap: 16,
    },
    waitingText: {
        color: '#8E8EA0',
        fontSize: 14,
        marginTop: 8,
    },
    lobbyCard: {
        backgroundColor: 'rgba(26, 26, 46, 0.85)',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    lobbyLabel: {
        color: '#5A5A72',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 2,
        marginBottom: 8,
    },
    lobbyCode: {
        fontSize: 36,
        fontWeight: '900',
        color: '#6C5CE7',
        letterSpacing: 6,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    copyBtn: {
        backgroundColor: 'rgba(108, 92, 231, 0.2)',
        borderRadius: 10,
        padding: 8,
    },
    copyBtnText: {
        fontSize: 22,
    },
    lobbyHint: {
        color: '#8E8EA0',
        fontSize: 13,
        marginTop: 8,
    },
    lobbyExpiry: {
        color: '#5A5A72',
        fontSize: 12,
        marginTop: 10,
        fontVariant: ['tabular-nums'] as any,
    },
    actions: {
        width: '100%',
        maxWidth: 340,
        gap: 6,
        alignItems: 'center',
    },
    imgBtn: {
        width: 360,     // +20% from 300
        height: 96,     // +20% from 80
    },
    imgBtnSmall: {
        width: 264,     // +20% from 220
        height: 70,     // +20% from 58
        marginTop: 14,
    },
    btnDisabled: {
        opacity: 0.4,
    },
    joinRow: {
        flexDirection: 'row',
        gap: 8,
    },
    codeInput: {
        flex: 1,
        backgroundColor: '#1A1A2E',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 4,
        textAlign: 'center',
    },
    joinButton: {
        backgroundColor: '#6C5CE7',
        paddingHorizontal: 20,
        borderRadius: 12,
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#E74C3C',
        paddingHorizontal: 20,
        borderRadius: 12,
        justifyContent: 'center',
    },
    joinButtonDisabled: {
        opacity: 0.4,
    },
    joinButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCard: {
        backgroundColor: '#1A1A2E',
        borderRadius: 20,
        padding: 32,
        width: '80%',
        maxWidth: 320,
        alignItems: 'center',
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 24,
    },
    muteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 20,
        width: '100%',
        gap: 16,
    },
    muteIcon: {
        width: 36,
        height: 36,
    },
    muteLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalCloseBtn: {
        marginTop: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
    },
    modalCloseBtnText: {
        color: '#8E8EA0',
        fontSize: 14,
        fontWeight: '700',
    },
    version: {
        position: 'absolute',
        bottom: 40,
        color: '#2A2A3E',
        fontSize: 12,
    },
});
