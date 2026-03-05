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
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import { getRankIcon } from '@/shared/types';
import EditProfileModal from '@/components/EditProfileModal';
import InventoryModal from '@/components/InventoryModal';
import FriendsModal from '@/components/FriendsModal';
import LeaderboardModal from '@/components/LeaderboardModal';
import MonthlyPassModal from '@/components/MonthlyPassModal';
import { supabase } from '@/lib/supabase';

const MAIN_BG = require('@/assets/images/backgrounds/main screen background.png');
const HOME_MUSIC = require('@/assets/audio/home screen music.mp3');

// Other UI assets
const LOBBY_FRAME = require('@/assets/images/UI/frames/lobby code background.png');
const SETTINGS_FRAME = require('@/assets/images/UI/frames/settings background.png');
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
    const [isMuted, setIsMuted] = useState(false);
    const [copied, setCopied] = useState(false);

    useBackgroundMusic(HOME_MUSIC, isMuted);
    const [lobbyCountdown, setLobbyCountdown] = useState(300);
    const lobbyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { profile, refreshProfile } = useAuth();
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
                    {/* Top bar: Profile + Settings */}
                    <View style={styles.topBar}>
                        <TouchableOpacity
                            style={styles.profileBadge}
                            onPress={() => setShowEditProfile(true)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.profileIconContainer}>
                                {equippedFrameUrl && (
                                    <Text style={styles.equippedFrame}>{equippedFrameUrl}</Text>
                                )}
                                <View style={styles.profileIconPlaceholder}>
                                    <Text style={styles.profileIconText}>{myUsername.charAt(0).toUpperCase()}</Text>
                                </View>
                            </View>
                            <View>
                                <Text style={styles.profileNameText} numberOfLines={1}>{myUsername}</Text>
                                {profile && (
                                    <View style={styles.statsRow}>
                                        <View style={styles.statBadge}>
                                            <Text style={styles.statText}>⭐ Lvl {profile.level}</Text>
                                        </View>
                                        <View style={[styles.statBadge, { backgroundColor: 'rgba(212, 167, 106, 0.2)' }]}>
                                            <Text style={styles.statText}>🪙 {profile.gold}</Text>
                                        </View>
                                        <View style={[styles.statBadge, { backgroundColor: 'rgba(108, 92, 231, 0.2)' }]}>
                                            <Text style={styles.statText}>💎 {profile.diamonds}</Text>
                                        </View>
                                    </View>
                                )}
                                {profile && (
                                    <View style={[styles.rankBadge, { marginTop: 4 * scaleFactor }]}>
                                        <Text style={styles.rankText}>
                                            {getRankIcon(profile.current_rank)} {profile.current_rank}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                            <TouchableOpacity
                                onPress={() => setShowFriends(true)}
                                activeOpacity={0.7}
                                style={styles.topBarIconBtn}
                            >
                                <Text style={{ fontSize: 24 }}>👥</Text>
                                {pendingRequests > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{pendingRequests}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => toggleSettings(true)}
                                activeOpacity={0.7}
                            >
                                <Image source={ICON_SETTINGS} style={styles.settingsIcon} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Title */}
                    <Animated.View style={[styles.header, { transform: [{ translateY: titleY }] }]}>
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

                                    {/* Shop and Inventory Row */}
                                    <View style={{ flexDirection: 'row', gap: 10 * scaleFactor, marginTop: 4 }}>
                                        <TouchableOpacity
                                            onPress={() => router.push('/shop')}
                                            activeOpacity={0.7}
                                            style={[
                                                styles.aiBtn,
                                                {
                                                    width: 125 * scaleFactor,
                                                    paddingVertical: 14 * scaleFactor,
                                                    borderRadius: 14 * scaleFactor,
                                                    backgroundColor: '#D4AF37',
                                                    borderColor: '#FFD700',
                                                }
                                            ]}
                                        >
                                            <Text style={[styles.aiBtnText, { fontSize: 13 * scaleFactor, color: '#333' }]}>🏪 Shop</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setShowInventory(true)}
                                            activeOpacity={0.7}
                                            style={[
                                                styles.aiBtn,
                                                {
                                                    width: 125 * scaleFactor,
                                                    paddingVertical: 14 * scaleFactor,
                                                    borderRadius: 14 * scaleFactor,
                                                    backgroundColor: '#4A90E2',
                                                    borderColor: '#5BADE2',
                                                }
                                            ]}
                                        >
                                            <Text style={[styles.aiBtnText, { fontSize: 13 * scaleFactor }]}>🎒 Bag</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => setShowMonthlyPass(true)}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.aiBtn,
                                            {
                                                width: 260 * scaleFactor,
                                                paddingVertical: 12 * scaleFactor,
                                                borderRadius: 14 * scaleFactor,
                                                backgroundColor: '#6c5ce7',
                                                borderColor: '#a29bfe',
                                                marginTop: 10 * scaleFactor,
                                            }
                                        ]}
                                    >
                                        <Text style={[styles.aiBtnText, { fontSize: 16 * scaleFactor }]}>🎟️ MONTHLY PASS</Text>
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
                                            outputRange: [0.9, 1.15], // Scale it up proportionally 15%
                                        }),
                                    }],
                                },
                            ]}
                        >
                            <ImageBackground
                                source={SETTINGS_FRAME}
                                style={styles.settingsFrame}
                                resizeMode="contain"
                            >
                                <View style={styles.settingsContent}>
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
                                        style={styles.settingsCloseBtn}
                                        onPress={() => toggleSettings(false)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.settingsCloseBtnText}>Close</Text>
                                    </TouchableOpacity>
                                </View>
                            </ImageBackground>
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
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'absolute',
        top: 52,
        left: 20,
        right: 20,
        zIndex: 10,
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
        width: 380,
        height: 520, // Increased height to allow it to be larger before scaling
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingsContent: {
        width: '100%',
        paddingHorizontal: 60,
        paddingTop: 80, // Bumped down from top umbrella
        alignItems: 'center',
        gap: 20,
    },
    muteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
        color: '#F5E6C8',
        fontSize: 16,
        fontWeight: '600',
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

