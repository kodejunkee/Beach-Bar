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
    useWindowDimensions,
    Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import * as Clipboard from 'expo-clipboard';
import { getRankIcon } from '@/shared/types';
import EditProfileModal from '@/components/EditProfileModal';
import InventoryModal from '@/components/InventoryModal';
import FriendsModal from '@/components/FriendsModal';
import LeaderboardModal from '@/components/LeaderboardModal';
import MonthlyPassModal from '@/components/MonthlyPassModal';
import { supabase } from '@/lib/supabase';

const MAIN_BG = require('@/assets/images/backgrounds/main screen background.png');
const HOME_MUSIC = require('@/assets/audio/home_screen_music.mp3');

// Other UI assets
const LOBBY_FRAME = require('@/assets/images/UI/frames/lobby code background.png');
const IMG_TITLE = require('@/assets/images/UI/banners/beach bar title.png');
const ICON_SETTINGS = require('@/assets/images/UI/icons/settings.png');
const ICON_MUTE = require('@/assets/images/UI/icons/mute.png');
const ICON_UNMUTE = require('@/assets/images/UI/icons/unmute.png');

export default function HomeScreen() {
    const { width } = useWindowDimensions();
    const PHONE_WIDTH = 450;
    const scaleFactor = Math.min(Math.max(width / PHONE_WIDTH, 1), 1.5);

    const [lobbyInput, setLobbyInput] = useState('');
    const [showJoinInput, setShowJoinInput] = useState(false);
    const [menuState, setMenuState] = useState<'main' | 'multiplayer' | 'custom'>('main');

    const [showSettings, setShowSettings] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showInventory, setShowInventory] = useState(false);
    const [showFriends, setShowFriends] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [showMonthlyPass, setShowMonthlyPass] = useState(false);
    const [equippedFrameUrl, setEquippedFrameUrl] = useState<string | null>(null);
    const [pendingRequests, setPendingRequests] = useState(0);
    const settingsAnim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = visible

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
    const [copied, setCopied] = useState(false);
    const [lobbyCountdown, setLobbyCountdown] = useState(300);
    const lobbyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { profile, signOut, refreshProfile } = useAuth();
    const {
        connectionStatus,
        connectionErrorMessage,
        retryConnection,
        phase,
        myUsername,
        lobbyCode,
        gameId,
        error,
        joinQuickMatch,
        joinRankedMatch,
        cancelQuickMatch,
        startAIGame,
        createLobby,
        cancelLobby,
        joinLobby,
        clearError,
        hasPlayedIntro,
        setHasPlayedIntro,
        updateUsername,
        isMuted,
        setIsMuted,
    } = useGame();

    const connected = connectionStatus === 'connected';

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

    // Refresh profile when returning to home screen
    useEffect(() => {
        if (phase === 'home') {
            refreshProfile();
        }
    }, [phase]);

    // Fetch equipped frame asset url when profile changes
    useEffect(() => {
        const fetchFrame = async () => {
            if (profile?.equipped_frame) {
                const { data } = await supabase
                    .from('shop_items')
                    .select('asset_url')
                    .eq('id', profile.equipped_frame)
                    .single();

                if (data) {
                    setEquippedFrameUrl(data.asset_url);
                }
            } else {
                setEquippedFrameUrl(null);
            }
        };
        fetchFrame();
    }, [profile?.equipped_frame]);

    // Fetch pending friend requests
    useEffect(() => {
        const fetchRequestsCount = async () => {
            if (!profile) return;
            const { count } = await supabase
                .from('friendships')
                .select('*', { count: 'exact', head: true })
                .eq('friend_id', profile.id)
                .eq('status', 'pending');

            setPendingRequests(count || 0);
        };

        fetchRequestsCount();
        const interval = setInterval(fetchRequestsCount, 10000); // Polling every 10s
        return () => clearInterval(interval);
    }, [profile?.id, showFriends]);

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

    if (connectionStatus !== 'connected') {
        return (
            <ImageBackground source={MAIN_BG} style={styles.bg} resizeMode="cover">
                <View style={[styles.bgOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Image
                        source={IMG_TITLE}
                        style={{ width: 400 * scaleFactor, height: 175 * scaleFactor, marginBottom: 40 * scaleFactor }}
                        resizeMode="contain"
                    />

                    {connectionStatus === 'connecting' ? (
                        <View style={{ alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#F1C40F" />
                            <Text style={{ color: '#FFF', marginTop: 15 * scaleFactor, fontSize: 18 * scaleFactor, fontWeight: 'bold' }}>
                                Connecting...
                            </Text>
                        </View>
                    ) : (
                        <View style={{ alignItems: 'center', paddingHorizontal: 40 * scaleFactor }}>
                            <Text style={{ fontSize: 40 * scaleFactor }}>⚠️</Text>
                            <Text style={{ color: '#FF7F50', marginTop: 15 * scaleFactor, fontSize: 18 * scaleFactor, textAlign: 'center', fontWeight: 'bold' }}>
                                {connectionErrorMessage || 'Error connecting to server.'}
                            </Text>
                            <TouchableOpacity
                                onPress={retryConnection}
                                activeOpacity={0.7}
                                style={[
                                    styles.aiBtn,
                                    {
                                        backgroundColor: '#6C5CE7',
                                        borderColor: '#A29BFE',
                                        width: 200 * scaleFactor,
                                        paddingVertical: 12 * scaleFactor,
                                        borderRadius: 14 * scaleFactor,
                                        marginTop: 30 * scaleFactor,
                                    }
                                ]}
                            >
                                <Text style={[styles.aiBtnText, { fontSize: 16 * scaleFactor }]}>RETRY</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ImageBackground>
        );
    }

    return (
        <ImageBackground source={MAIN_BG} style={styles.bg} resizeMode="cover">
            <View style={styles.bgOverlay}>
                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* New Header Section */}
                    <View style={[styles.headerContainer, { paddingTop: 35 * scaleFactor, paddingHorizontal: 12 * scaleFactor }]}>
                        {/* Profile Section (Left) */}
                        <View style={[styles.profileSection, { height: 52 * scaleFactor, paddingRight: 10 * scaleFactor }]}>
                            <TouchableOpacity
                                style={[styles.avatarFrame, { width: 52 * scaleFactor, height: 52 * scaleFactor, borderRadius: 8 * scaleFactor, borderWidth: 2 * scaleFactor }]}
                                onPress={() => setShowEditProfile(true)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.avatarInner}>
                                    <Text style={[styles.avatarLetter, { fontSize: 22 * scaleFactor }]}>{myUsername.charAt(0).toUpperCase()}</Text>
                                </View>
                            </TouchableOpacity>

                            <View style={[styles.infoBox, { marginLeft: 8 * scaleFactor }]}>
                                <Text style={[styles.headerUsername, { fontSize: 13 * scaleFactor }]} numberOfLines={1}>{myUsername}</Text>
                                <View style={[styles.levelBadge, { paddingHorizontal: 6 * scaleFactor, paddingVertical: 1 * scaleFactor, borderRadius: 4 * scaleFactor, marginTop: 2 * scaleFactor }]}>
                                    <Text style={[styles.levelText, { fontSize: 10 * scaleFactor }]}>LVL {profile?.level || 1}</Text>
                                </View>
                            </View>

                            {profile && (
                                <View style={[styles.headerRankIcon, { marginLeft: 6 * scaleFactor }]}>
                                    <Text style={{ fontSize: 22 * scaleFactor }}>{getRankIcon(profile.current_rank)}</Text>
                                </View>
                            )}
                        </View>

                        {/* Currency Section (Right) */}
                        <View style={[styles.currencySection, { gap: 8 * scaleFactor }]}>
                            <View style={[styles.currencyItem, { height: 32 * scaleFactor, paddingLeft: 4 * scaleFactor, paddingRight: 2 * scaleFactor, borderWidth: 1 * scaleFactor }]}>
                                <Text style={[styles.currencyIcon, { fontSize: 15 * scaleFactor }]}>🪙</Text>
                                <View style={[styles.currencyValueBg, { minWidth: 38 * scaleFactor, paddingHorizontal: 5 * scaleFactor }]}>
                                    <Text style={[styles.currencyValue, { fontSize: 12 * scaleFactor }]}>{profile?.gold || 0}</Text>
                                </View>
                                <TouchableOpacity style={[styles.addBtn, { width: 20 * scaleFactor, height: 20 * scaleFactor, borderRadius: 10 * scaleFactor, borderWidth: 1 * scaleFactor }]}>
                                    <Text style={[styles.addBtnText, { fontSize: 14 * scaleFactor, lineHeight: 16 * scaleFactor }]}>+</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.currencyItem, { height: 32 * scaleFactor, paddingLeft: 4 * scaleFactor, paddingRight: 2 * scaleFactor, borderWidth: 1 * scaleFactor }]}>
                                <Text style={[styles.currencyIcon, { fontSize: 15 * scaleFactor }]}>💎</Text>
                                <View style={[styles.currencyValueBg, { minWidth: 38 * scaleFactor, paddingHorizontal: 5 * scaleFactor }]}>
                                    <Text style={[styles.currencyValue, { fontSize: 12 * scaleFactor }]}>{profile?.diamonds || 0}</Text>
                                </View>
                                <TouchableOpacity style={[styles.addBtn, { width: 20 * scaleFactor, height: 20 * scaleFactor, borderRadius: 10 * scaleFactor, borderWidth: 1 * scaleFactor }]}>
                                    <Text style={[styles.addBtnText, { fontSize: 14 * scaleFactor, lineHeight: 16 * scaleFactor }]}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Sub-Header Navigation Buttons */}
                    <View style={[styles.navRow, { marginTop: 12 * scaleFactor, gap: 8 * scaleFactor, paddingHorizontal: 12 * scaleFactor }]}>
                        <TouchableOpacity style={[styles.navBtn, { maxWidth: 70 * scaleFactor }]} onPress={() => setShowFriends(true)}>
                            <View style={[styles.navIconBg, { width: 52 * scaleFactor, height: 52 * scaleFactor, borderRadius: 12 * scaleFactor, borderWidth: 2 * scaleFactor }]}>
                                <Text style={[styles.navIcon, { fontSize: 24 * scaleFactor }]}>👥</Text>
                                {pendingRequests > 0 && (
                                    <View style={[styles.navBadge, { minWidth: 18 * scaleFactor, height: 18 * scaleFactor, borderRadius: 9 * scaleFactor, top: -4 * scaleFactor, right: -4 * scaleFactor, borderWidth: 2 * scaleFactor }]}>
                                        <Text style={[styles.navBadgeText, { fontSize: 9 * scaleFactor }]}>{pendingRequests}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.navLabel, { fontSize: 9 * scaleFactor, marginTop: 4 * scaleFactor }]} adjustsFontSizeToFit numberOfLines={1}>FRIENDS</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.navBtn, { maxWidth: 70 * scaleFactor }]} onPress={() => setShowMonthlyPass(true)}>
                            <View style={[styles.navIconBg, { width: 52 * scaleFactor, height: 52 * scaleFactor, borderRadius: 12 * scaleFactor, borderWidth: 2 * scaleFactor }]}>
                                <Text style={[styles.navIcon, { fontSize: 24 * scaleFactor }]}>🎫</Text>
                            </View>
                            <Text style={[styles.navLabel, { fontSize: 9 * scaleFactor, marginTop: 4 * scaleFactor }]} adjustsFontSizeToFit numberOfLines={1}>PASS</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.navBtn, { maxWidth: 70 * scaleFactor }]} onPress={() => Alert.alert("Coming Soon", "Quests feature will be added in a future update!")}>
                            <View style={[styles.navIconBg, { width: 52 * scaleFactor, height: 52 * scaleFactor, borderRadius: 12 * scaleFactor, borderWidth: 2 * scaleFactor }]}>
                                <Text style={[styles.navIcon, { fontSize: 24 * scaleFactor }]}>�</Text>
                            </View>
                            <Text style={[styles.navLabel, { fontSize: 9 * scaleFactor, marginTop: 4 * scaleFactor }]} adjustsFontSizeToFit numberOfLines={1}>QUESTS</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.navBtn, { maxWidth: 70 * scaleFactor }]} onPress={() => router.push('/shop')}>
                            <View style={[styles.navIconBg, { width: 52 * scaleFactor, height: 52 * scaleFactor, borderRadius: 12 * scaleFactor, borderWidth: 2 * scaleFactor }]}>
                                <Text style={[styles.navIcon, { fontSize: 24 * scaleFactor }]}>�</Text>
                            </View>
                            <Text style={[styles.navLabel, { fontSize: 9 * scaleFactor, marginTop: 4 * scaleFactor }]} adjustsFontSizeToFit numberOfLines={1}>SHOP</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.navBtn, { maxWidth: 70 * scaleFactor }]} onPress={() => toggleSettings(true)}>
                            <View style={[styles.navIconBg, { width: 52 * scaleFactor, height: 52 * scaleFactor, borderRadius: 12 * scaleFactor, borderWidth: 2 * scaleFactor }]}>
                                <Text style={[styles.navIcon, { fontSize: 24 * scaleFactor }]}>⚙️</Text>
                            </View>
                            <Text style={[styles.navLabel, { fontSize: 9 * scaleFactor, marginTop: 4 * scaleFactor }]} adjustsFontSizeToFit numberOfLines={1}>SETTINGS</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Title with extra breathing space */}
                    <Animated.View style={[styles.header, { transform: [{ translateY: titleY }], marginTop: 60 * scaleFactor, marginBottom: 60 * scaleFactor }]}>
                        <Image
                            source={IMG_TITLE}
                            style={[
                                styles.titleImg,
                                {
                                    width: 540 * scaleFactor,
                                    height: 236 * scaleFactor
                                }
                            ]}
                            resizeMode="contain"
                        />
                    </Animated.View>

                    {/* Connection Status handled via Splash Screen above */}

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
                            <TouchableOpacity
                                onPress={cancelQuickMatch}
                                activeOpacity={0.7}
                                style={[
                                    styles.aiBtn,
                                    {
                                        backgroundColor: '#8B0000', // Dark red for cancel
                                        borderColor: '#FF7F50',
                                        width: 264 * scaleFactor,
                                        paddingVertical: 10 * scaleFactor,
                                        borderRadius: 12 * scaleFactor,
                                        marginTop: 10 * scaleFactor,
                                    }
                                ]}
                            >
                                <Text style={[
                                    styles.aiBtnText,
                                    { fontSize: 16 * scaleFactor }
                                ]}>CANCEL</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Lobby waiting */}
                    {phase === 'lobby' && lobbyCode && (
                        <ImageBackground
                            source={LOBBY_FRAME}
                            style={styles.lobbyCard}
                            imageStyle={styles.lobbyCardImage}
                            resizeMode="stretch"
                        >
                            <View style={styles.lobbyCardInner}>
                                <Text style={styles.lobbyLabel}>LOBBY CODE</Text>
                                <View style={styles.codeContainer}>
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
                                        <Text style={styles.copyBtnText}>{copied ? 'Copied ✓' : 'Copy Code 📋'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.lobbyHint}>
                                    {copied ? 'Copied to clipboard!' : 'Share this code with a friend'}
                                </Text>
                                <ActivityIndicator size="small" color="#8B6914" style={{ marginTop: 12 }} />
                                <Text style={[styles.waitingText, { color: '#5C3D1A' }]}>Waiting for opponent…</Text>
                                <Text style={styles.lobbyExpiry}>
                                    Expires in {String(Math.floor(lobbyCountdown / 60)).padStart(2, '0')}:{String(lobbyCountdown % 60).padStart(2, '0')}
                                </Text>
                                <TouchableOpacity
                                    onPress={cancelLobby}
                                    activeOpacity={0.7}
                                    style={[
                                        styles.aiBtn,
                                        {
                                            backgroundColor: '#8B0000', // Dark red for cancel
                                            borderColor: '#FF7F50',
                                            width: 264 * scaleFactor,
                                            paddingVertical: 10 * scaleFactor,
                                            borderRadius: 12 * scaleFactor,
                                            marginTop: 10 * scaleFactor,
                                        }
                                    ]}
                                >
                                    <Text style={[
                                        styles.aiBtnText,
                                        { fontSize: 16 * scaleFactor }
                                    ]}>CANCEL</Text>
                                </TouchableOpacity>
                            </View>
                        </ImageBackground>
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
                            {menuState === 'main' && (
                                <>
                                    <TouchableOpacity
                                        onPress={startAIGame}
                                        disabled={!connected}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.aiBtn,
                                            !connected && styles.btnDisabled,
                                            {
                                                width: 260 * scaleFactor,
                                                paddingVertical: 14 * scaleFactor,
                                                borderRadius: 14 * scaleFactor,
                                            }
                                        ]}
                                    >
                                        <Text style={[styles.aiBtnText, { fontSize: 20 * scaleFactor }]}>⚔️  vs AI</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setMenuState('multiplayer')}
                                        disabled={!connected}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.aiBtn,
                                            !connected && styles.btnDisabled,
                                            {
                                                width: 260 * scaleFactor,
                                                paddingVertical: 14 * scaleFactor,
                                                borderRadius: 14 * scaleFactor,
                                            }
                                        ]}
                                    >
                                        <Text style={[styles.aiBtnText, { fontSize: 20 * scaleFactor }]}>🌍  Multiplayer</Text>
                                    </TouchableOpacity>

                                </>
                            )}

                            {menuState === 'multiplayer' && (
                                <>
                                    <TouchableOpacity
                                        onPress={joinQuickMatch}
                                        disabled={!connected}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.aiBtn,
                                            !connected && styles.btnDisabled,
                                            {
                                                width: 260 * scaleFactor,
                                                paddingVertical: 14 * scaleFactor,
                                                borderRadius: 14 * scaleFactor,
                                            }
                                        ]}
                                    >
                                        <Text style={[styles.aiBtnText, { fontSize: 20 * scaleFactor }]}>⚡ Classic Mode</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => router.push('/ranked')}
                                        disabled={!connected}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.aiBtn,
                                            !connected && styles.btnDisabled,
                                            {
                                                width: 260 * scaleFactor,
                                                paddingVertical: 14 * scaleFactor,
                                                borderRadius: 14 * scaleFactor,
                                                backgroundColor: '#6C5CE7',
                                                borderColor: '#A29BFE',
                                            }
                                        ]}
                                    >
                                        <Text style={[styles.aiBtnText, { fontSize: 20 * scaleFactor }]}>🏆 Ranked Mode</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setMenuState('custom')}
                                        disabled={!connected}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.aiBtn,
                                            !connected && styles.btnDisabled,
                                            {
                                                width: 260 * scaleFactor,
                                                paddingVertical: 14 * scaleFactor,
                                                borderRadius: 14 * scaleFactor,
                                            }
                                        ]}
                                    >
                                        <Text style={[styles.aiBtnText, { fontSize: 20 * scaleFactor }]}>🎮 Custom Match</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setMenuState('main')}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.aiBtn,
                                            {
                                                backgroundColor: '#8B0000',
                                                borderColor: '#FF7F50',
                                                width: 260 * scaleFactor,
                                                paddingVertical: 10 * scaleFactor,
                                                borderRadius: 14 * scaleFactor,
                                                marginTop: 10 * scaleFactor,
                                            }
                                        ]}
                                    >
                                        <Text style={[styles.aiBtnText, { fontSize: 16 * scaleFactor }]}>BACK</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {menuState === 'custom' && (
                                <>
                                    {!showJoinInput ? (
                                        <>
                                            <TouchableOpacity
                                                onPress={createLobby}
                                                disabled={!connected}
                                                activeOpacity={0.7}
                                                style={[
                                                    styles.aiBtn,
                                                    !connected && styles.btnDisabled,
                                                    {
                                                        width: 260 * scaleFactor,
                                                        paddingVertical: 14 * scaleFactor,
                                                        borderRadius: 14 * scaleFactor,
                                                    }
                                                ]}
                                            >
                                                <Text style={[styles.aiBtnText, { fontSize: 20 * scaleFactor }]}>🏠 Create Lobby</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => setShowJoinInput(true)}
                                                disabled={!connected}
                                                activeOpacity={0.7}
                                                style={[
                                                    styles.aiBtn,
                                                    !connected && styles.btnDisabled,
                                                    {
                                                        width: 260 * scaleFactor,
                                                        paddingVertical: 14 * scaleFactor,
                                                        borderRadius: 14 * scaleFactor,
                                                    }
                                                ]}
                                            >
                                                <Text style={[styles.aiBtnText, { fontSize: 20 * scaleFactor }]}>🤝 Join Lobby</Text>
                                            </TouchableOpacity>
                                        </>
                                    ) : (
                                        <View style={styles.joinRow}>
                                            <TextInput
                                                style={[
                                                    styles.codeInput,
                                                    {
                                                        fontSize: 18 * scaleFactor,
                                                        paddingVertical: 14 * scaleFactor,
                                                        paddingHorizontal: 16 * scaleFactor,
                                                        minWidth: 160 * scaleFactor,
                                                    }
                                                ]}
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
                                                    <Text style={[styles.joinButtonText, { fontSize: 14 * scaleFactor }]}>CANCEL</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    style={[styles.joinButton, lobbyInput.trim().length < 6 && styles.joinButtonDisabled]}
                                                    onPress={handleJoinLobby}
                                                    disabled={lobbyInput.trim().length < 6}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={[styles.joinButtonText, { fontSize: 14 * scaleFactor }]}>JOIN</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}

                                    {!showJoinInput && (
                                        <TouchableOpacity
                                            onPress={() => setMenuState('multiplayer')}
                                            activeOpacity={0.7}
                                            style={[
                                                styles.aiBtn,
                                                {
                                                    backgroundColor: '#8B0000',
                                                    borderColor: '#FF7F50',
                                                    width: 260 * scaleFactor,
                                                    paddingVertical: 10 * scaleFactor,
                                                    borderRadius: 14 * scaleFactor,
                                                    marginTop: 10 * scaleFactor,
                                                }
                                            ]}
                                        >
                                            <Text style={[styles.aiBtnText, { fontSize: 16 * scaleFactor }]}>BACK</Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}
                        </Animated.View>
                    )}

                    <Text style={styles.version}>v1.0.0</Text>
                </KeyboardAvoidingView>

                {/* Edit Profile Modal */}
                <EditProfileModal
                    visible={showEditProfile}
                    currentUsername={myUsername}
                    profile={profile}
                    onSave={updateUsername}
                    onClose={() => setShowEditProfile(false)}
                />

                <InventoryModal
                    visible={showInventory}
                    onClose={() => setShowInventory(false)}
                />

                <FriendsModal
                    visible={showFriends}
                    onClose={() => setShowFriends(false)}
                />

                <LeaderboardModal
                    visible={showLeaderboard}
                    onClose={() => setShowLeaderboard(false)}
                />

                <MonthlyPassModal
                    visible={showMonthlyPass}
                    onClose={() => setShowMonthlyPass(false)}
                />

                {/* Settings Panel - slides down from icon */}
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
                                            outputRange: [40, 0],
                                        }),
                                    }, {
                                        scale: settingsAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.9, 1.05], // Reduced scale factor
                                        }),
                                    }],
                                },
                            ]}
                        >
                            <View style={styles.settingsFrame}>
                                <View style={styles.settingsContent}>
                                    <TouchableOpacity
                                        style={styles.muteRow}
                                        onPress={() => setIsMuted(!isMuted)}
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
                                        style={[styles.muteRow, styles.logoutRow]}
                                        onPress={() => {
                                            toggleSettings(false);
                                            signOut();
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.logoutLabel}>Logout</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.settingsCloseBtn}
                                        onPress={() => toggleSettings(false)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.settingsCloseBtnText}>Close</Text>
                                    </TouchableOpacity>
                                </View>
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
    bgOverlay: {
        flex: 1,
        backgroundColor: 'rgba(8, 8, 22, 0.48)',
    },
    container: {
        flex: 1,
        // justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        paddingHorizontal: 0,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 52,
        width: '100%',
        zIndex: 10,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 12,
        paddingRight: 15,
        height: 56,
    },
    avatarFrame: {
        width: 56,
        height: 56,
        borderWidth: 2,
        borderColor: '#7D5FFF',
        borderRadius: 8,
        backgroundColor: '#1A1A2E',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarInner: {
        width: '100%',
        height: '100%',
        backgroundColor: '#30304A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '900',
    },
    infoBox: {
        marginLeft: 12,
        justifyContent: 'center',
    },
    headerUsername: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    levelBadge: {
        backgroundColor: '#F1C40F',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        marginTop: 2,
        alignSelf: 'flex-start',
    },
    levelText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
    },
    headerRankIcon: {
        marginLeft: 8,
    },
    currencySection: {
        flexDirection: 'row',
        gap: 12,
    },
    currencyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 20,
        paddingLeft: 4,
        paddingRight: 2,
        height: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    currencyIcon: {
        fontSize: 16,
        zIndex: 2,
    },
    currencyValueBg: {
        minWidth: 50,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    currencyValue: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
    },
    addBtn: {
        backgroundColor: '#2ECC71',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1A1A2E',
    },
    addBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '900',
        lineHeight: 18,
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        paddingHorizontal: 20,
        marginTop: 15,
        gap: 10,
        zIndex: 5,
    },
    navBtn: {
        alignItems: 'center',
        flex: 1,
        maxWidth: 70,
    },
    navIconBg: {
        width: 54,
        height: 54,
        backgroundColor: 'rgba(26, 26, 46, 0.9)',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#30304A',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    navIcon: {
        fontSize: 26,
    },
    navLabel: {
        color: '#FFF',
        fontSize: 9,
        fontWeight: '900',
        marginTop: 4,
        letterSpacing: 0.5,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    navBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#E74C3C',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#1A1A2E',
    },
    navBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        paddingHorizontal: 4,
    },
    profileBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileIconContainer: {
        position: 'relative',
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    equippedFrame: {
        position: 'absolute',
        fontSize: 56, // Larger than icon to wrap around
        zIndex: 0, // Behind the profile icon until we have real frame assets
    },
    profileIconPlaceholder: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#7D5FFF',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    profileIconText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    profileNameText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        maxWidth: 180,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    settingsIcon: {
        width: 48,
        height: 48,
    },
    header: {
        alignItems: 'center',
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
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    lobbyCardImage: {
        borderRadius: 16,
    },
    lobbyCardInner: {
        paddingHorizontal: 50,
        marginTop: 20,
        paddingTop: 70,
        paddingBottom: 60,
        alignItems: 'center',
    },
    lobbyLabel: {
        color: '#5C3D1A',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 8,
    },
    lobbyCode: {
        fontSize: 33,
        fontWeight: '900',
        color: '#7B3F00',
        letterSpacing: 5,
    },
    codeContainer: {
        alignItems: 'center',
        gap: 8,
    },
    copyBtn: {
        backgroundColor: 'rgba(139, 105, 20, 0.2)',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#5C3D1A',
    },
    lobbyHint: {
        color: '#6B4D2E',
        fontSize: 13,
        marginTop: 8,
    },
    lobbyExpiry: {
        color: '#8B6914',
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
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingsFrame: {
        width: 280, // More compact width
        backgroundColor: '#1A1A2E',
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#D4A76A',
        paddingVertical: 30, // Reduced padding
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    settingsContent: {
        width: '100%',
        alignItems: 'center',
        gap: 15, // Tighter spacing
    },
    muteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 12,
        paddingVertical: 12, // More compact row
        paddingHorizontal: 16,
        width: '100%',
        gap: 16,
    },
    muteIcon: {
        width: 36,
        height: 36,
    },
    muteLabel: {
        color: '#F5E6C8',
        fontSize: 16,
        fontWeight: '600',
    },
    logoutRow: {
        backgroundColor: 'rgba(231, 76, 60, 0.15)',
        marginTop: 8,
    },
    logoutLabel: {
        color: '#E74C3C',
        fontSize: 14,
        fontWeight: '700',
    },
    settingsCloseBtn: {
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
    },
    settingsCloseBtnText: {
        color: '#D4A76A',
        fontSize: 14,
        fontWeight: '700',
    },
    version: {
        position: 'absolute',
        bottom: 40,
        color: '#2A2A3E',
        fontSize: 12,
    },
    aiBtn: {
        backgroundColor: '#7B3F00',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#D4A76A',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    aiBtnText: {
        color: '#F4E9D8',
        fontWeight: '900',
        letterSpacing: 2,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 4,
        gap: 6,
    },
    statBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    statText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    topBarIconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#e84118',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#1e1e1e',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        paddingHorizontal: 4,
    },
    rankBadge: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    rankText: {
        color: '#F1C40F',
        fontSize: 12,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
});

