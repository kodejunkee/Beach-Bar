import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ImageBackground,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { getRankIcon } from '@/shared/types';
import { supabase } from '@/lib/supabase';
import LeaderboardModal from '@/components/LeaderboardModal';
import SeasonProgressModal from '@/components/SeasonProgressModal';

export default function RankedScreen() {
    const router = useRouter();
    const { playerProfile } = useAuth();
    const { joinRankedMatch } = useGame();

    const [leaderboardVisible, setLeaderboardVisible] = useState(false);
    const [progressVisible, setProgressVisible] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>('Loading...');

    useEffect(() => {
        fetchSeasonTime();
        const interval = setInterval(fetchSeasonTime, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    const fetchSeasonTime = async () => {
        try {
            const { data, error } = await supabase
                .from('seasons')
                .select('end_date')
                .eq('is_active', true)
                .single();

            if (error || !data?.end_date) {
                setTimeLeft('No active season');
                return;
            }

            const now = new Date();
            const end = new Date(data.end_date);
            const diffMs = end.getTime() - now.getTime();

            if (diffMs <= 0) {
                setTimeLeft('Season ending...');
                return;
            }

            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays >= 1) {
                setTimeLeft(`${diffDays} days`);
            } else if (diffHours >= 1) {
                setTimeLeft(`${diffHours} hrs`);
            } else {
                setTimeLeft(`${diffMins} mins`);
            }
        } catch (err) {
            console.error('Error fetching season time:', err);
            setTimeLeft('Error');
        }
    };

    const handleStartMatch = () => {
        joinRankedMatch();
        router.back(); // Go back to home where the connecting splash/status will show
    };

    return (
        <ImageBackground
            source={require('@/assets/images/backgrounds/game screen beach background.png')}
            style={styles.container}
        >
            <SafeAreaView style={{ flex: 1 }}>
                <Stack.Screen options={{ headerShown: false }} />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={28} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Ranked Hub</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Rank Info Card */}
                    <View style={styles.rankCard}>
                        <Text style={styles.rankIcon}>{getRankIcon(playerProfile?.current_rank)}</Text>
                        <Text style={styles.rankTier}>{playerProfile?.current_rank || 'Bronze V'}</Text>
                        <Text style={styles.rpText}>{playerProfile?.rp || 0} RP</Text>

                        <View style={styles.divider} />

                        <View style={styles.timeContainer}>
                            <Ionicons name="time-outline" size={18} color="#FFD700" />
                            <Text style={styles.timeLabel}>Time till Season Reset:</Text>
                            <Text style={styles.timeValue}>{timeLeft}</Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.buttonGrid}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.matchBtn]}
                            onPress={handleStartMatch}
                        >
                            <Ionicons name="play" size={32} color="#FFF" />
                            <Text style={styles.btnText}>Start Match</Text>
                        </TouchableOpacity>

                        <View style={styles.row}>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.secondaryBtn]}
                                onPress={() => setLeaderboardVisible(true)}
                            >
                                <Ionicons name="trophy" size={24} color="#FFD700" />
                                <Text style={styles.secondaryBtnText}>Leaderboard</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionBtn, styles.secondaryBtn]}
                                onPress={() => setProgressVisible(true)}
                            >
                                <Ionicons name="trending-up" size={24} color="#3498db" />
                                <Text style={styles.secondaryBtnText}>Season Progress</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stats Summary (Optional/Quick View) */}
                    <View style={styles.statsSummary}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{playerProfile?.ranked_wins || 0}</Text>
                            <Text style={styles.statLabel}>Wins</Text>
                        </View>
                        <View style={styles.verticalDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{playerProfile?.ranked_losses || 0}</Text>
                            <Text style={styles.statLabel}>Losses</Text>
                        </View>
                        <View style={styles.verticalDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {playerProfile?.ranked_wins && (playerProfile.ranked_wins + playerProfile.ranked_losses) > 0
                                    ? Math.round((playerProfile.ranked_wins / (playerProfile.ranked_wins + playerProfile.ranked_losses)) * 100)
                                    : 0}%
                            </Text>
                            <Text style={styles.statLabel}>Win Rate</Text>
                        </View>
                    </View>
                </ScrollView>

                {/* Modals */}
                <LeaderboardModal
                    visible={leaderboardVisible}
                    onClose={() => setLeaderboardVisible(false)}
                />
                <SeasonProgressModal
                    visible={progressVisible}
                    onClose={() => setProgressVisible(false)}
                    currentRank={playerProfile?.current_rank}
                    currentRp={playerProfile?.rp}
                />
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    scrollContent: {
        padding: 20,
        alignItems: 'center',
    },
    rankCard: {
        width: '100%',
        backgroundColor: 'rgba(26, 26, 46, 0.9)',
        borderRadius: 30,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
        marginBottom: 30,
    },
    rankIcon: {
        fontSize: 80,
        marginBottom: 10,
    },
    rankTier: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: 2,
    },
    rpText: {
        color: '#FFD700',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 5,
    },
    divider: {
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 20,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeLabel: {
        color: '#8E8EA0',
        fontSize: 14,
        marginLeft: 8,
    },
    timeValue: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    buttonGrid: {
        width: '100%',
        gap: 15,
    },
    matchBtn: {
        backgroundColor: '#e67e22',
        height: 100,
        flexDirection: 'column',
        justifyContent: 'center',
        borderBottomWidth: 5,
        borderBottomColor: '#d35400',
    },
    actionBtn: {
        borderRadius: 20,
        padding: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 5,
    },
    row: {
        flexDirection: 'row',
        gap: 15,
    },
    secondaryBtn: {
        flex: 1,
        backgroundColor: 'rgba(26, 26, 46, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        height: 80,
    },
    secondaryBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 5,
    },
    statsSummary: {
        flexDirection: 'row',
        backgroundColor: 'rgba(26, 26, 46, 0.8)',
        borderRadius: 20,
        padding: 20,
        marginTop: 30,
        width: '100%',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    statLabel: {
        color: '#8E8EA0',
        fontSize: 12,
        marginTop: 4,
    },
    verticalDivider: {
        width: 1,
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
});
