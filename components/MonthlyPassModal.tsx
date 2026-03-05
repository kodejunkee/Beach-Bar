import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface MonthlyPassModalProps {
    visible: boolean;
    onClose: () => void;
}

type PassLevel = {
    level: number;
    exp_required: number;
    reward_type: 'gold' | 'diamonds' | 'item';
    reward_amount: number;
    reward_item_id: string | null;
};

type UserPass = {
    current_exp: number;
    current_level: number;
    last_claimed_level: number;
};

type Quest = {
    id: string;
    name: string;
    description: string;
    objective_type: string;
    objective_count: number;
    exp_reward: number;
    progress?: {
        current_count: number;
        completed: boolean;
    };
};

export default function MonthlyPassModal({ visible, onClose }: MonthlyPassModalProps) {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'pass' | 'quests'>('pass');
    const [passLevels, setPassLevels] = useState<PassLevel[]>([]);
    const [userPass, setUserPass] = useState<UserPass | null>(null);
    const [quests, setQuests] = useState<Quest[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && profile) {
            fetchPassData();
        }
    }, [visible, profile]);

    const fetchPassData = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            // 1. Fetch Pass Levels
            const { data: levelsData } = await supabase
                .from('monthly_pass_levels')
                .select('*')
                .order('level', { ascending: true });
            if (levelsData) setPassLevels(levelsData);

            // 2. Fetch User Pass Progress
            const { data: passData } = await supabase
                .from('user_monthly_pass')
                .select('*')
                .eq('user_id', profile.id)
                .single();

            if (passData) {
                setUserPass(passData);
            } else {
                // Initialize if not exists
                const { data: newPass } = await supabase
                    .from('user_monthly_pass')
                    .insert({ user_id: profile.id })
                    .select()
                    .single();
                if (newPass) setUserPass(newPass);
            }

            // 3. Fetch Quests and Progress
            const { data: questsData } = await supabase
                .from('daily_quests')
                .select('*');

            const { data: progressData } = await supabase
                .from('user_quest_progress')
                .select('*')
                .eq('user_id', profile.id);

            if (questsData) {
                const combinedQuests = questsData.map(q => ({
                    ...q,
                    progress: progressData?.find(p => p.quest_id === q.id) || { current_count: 0, completed: false }
                }));
                setQuests(combinedQuests);
            }

        } catch (err) {
            console.error('Error fetching pass data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async (level: number) => {
        try {
            const { data, error } = await supabase.rpc('claim_pass_reward', {
                target_level: level
            });

            if (error) throw error;
            if (data.success) {
                Alert.alert('Success', 'Reward claimed!');
                fetchPassData();
            } else {
                Alert.alert('Error', data.error || 'Failed to claim reward');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'An unexpected error occurred');
        }
    };

    const renderPassItem = ({ item }: { item: PassLevel }) => {
        const isReached = userPass ? userPass.current_level >= item.level : false;
        const isClaimed = userPass ? userPass.last_claimed_level >= item.level : false;
        const canClaim = isReached && !isClaimed;

        return (
            <View style={[styles.passItem, isReached && styles.passItemReached]}>
                <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{item.level}</Text>
                </View>
                <View style={styles.rewardInfo}>
                    <Text style={styles.rewardTitle}>
                        {item.reward_type === 'gold' ? '🪙 Gold' : item.reward_type === 'diamonds' ? '💎 Diamonds' : '🎁 Item'}
                    </Text>
                    <Text style={styles.rewardAmount}>
                        {item.reward_type === 'item' ? 'Exclusive Frame' : `x${item.reward_amount}`}
                    </Text>
                </View>
                {isClaimed ? (
                    <View style={styles.claimedBadge}>
                        <Text style={styles.claimedText}>Claimed</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.claimBtn, !canClaim && styles.claimBtnDisabled]}
                        onPress={() => handleClaim(item.level)}
                        disabled={!canClaim}
                    >
                        <Text style={styles.claimBtnText}>{isReached ? 'Claim' : 'Locked'}</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderQuestItem = ({ item }: { item: Quest }) => {
        const progress = item.progress?.current_count || 0;
        const total = item.objective_count;
        const percent = Math.min(progress / total, 1);
        const isCompleted = item.progress?.completed || false;

        return (
            <View style={styles.questItem}>
                <View style={styles.questHeader}>
                    <Text style={styles.questName}>{item.name}</Text>
                    <Text style={styles.questExp}>+{item.exp_reward} XP</Text>
                </View>
                <Text style={styles.questDesc}>{item.description}</Text>
                <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${percent * 100}%` }]} />
                    <Text style={styles.progressText}>{progress}/{total}</Text>
                </View>
                {isCompleted && (
                    <View style={styles.questOverlay}>
                        <Text style={styles.completedCheck}>✓ Completed</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>Monthly Pass</Text>
                            {userPass && (
                                <Text style={styles.headerSub}>Level {userPass.current_level} Pass</Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'pass' && styles.activeTab]}
                            onPress={() => setActiveTab('pass')}
                        >
                            <Text style={[styles.tabText, activeTab === 'pass' && styles.activeTabText]}>Rewards</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'quests' && styles.activeTab]}
                            onPress={() => setActiveTab('quests')}
                        >
                            <Text style={[styles.tabText, activeTab === 'quests' && styles.activeTabText]}>Daily Quests</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        {loading && <ActivityIndicator color="#6c5ce7" style={{ marginTop: 20 }} />}

                        {activeTab === 'pass' && (
                            <FlatList
                                data={passLevels}
                                renderItem={renderPassItem}
                                keyExtractor={item => item.level.toString()}
                                contentContainerStyle={{ padding: 15 }}
                            />
                        )}

                        {activeTab === 'quests' && (
                            <FlatList
                                data={quests}
                                renderItem={renderQuestItem}
                                keyExtractor={item => item.id}
                                contentContainerStyle={{ padding: 15 }}
                            />
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxHeight: '90%',
        backgroundColor: '#1c1c1e',
        borderRadius: 30,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 25,
        backgroundColor: '#2c2c2e',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 26,
        fontWeight: 'bold',
    },
    headerSub: {
        color: '#6c5ce7',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 2,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        color: '#FFF',
        fontSize: 28,
        marginTop: -3,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#2c2c2e',
    },
    tab: {
        flex: 1,
        paddingVertical: 15,
        alignItems: 'center',
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#6c5ce7',
    },
    tabText: {
        color: '#888',
        fontSize: 15,
        fontWeight: 'bold',
    },
    activeTabText: {
        color: '#FFF',
    },
    content: {
        flex: 1,
    },
    passItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    passItemReached: {
        backgroundColor: 'rgba(108, 92, 231, 0.1)',
        borderColor: 'rgba(108, 92, 231, 0.3)',
    },
    levelBadge: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    levelBadgeText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    rewardInfo: {
        flex: 1,
        marginLeft: 15,
    },
    rewardTitle: {
        color: '#8E8EA0',
        fontSize: 12,
        fontWeight: '600',
    },
    rewardAmount: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 2,
    },
    claimBtn: {
        backgroundColor: '#6c5ce7',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
    },
    claimBtnDisabled: {
        backgroundColor: '#444',
        opacity: 0.6,
    },
    claimBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    claimedBadge: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(76, 209, 55, 0.1)',
        borderWidth: 1,
        borderColor: '#4cd137',
    },
    claimedText: {
        color: '#4cd137',
        fontSize: 14,
        fontWeight: 'bold',
    },
    questItem: {
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        marginBottom: 15,
        position: 'relative',
        overflow: 'hidden',
    },
    questHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    questName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    questExp: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: 'bold',
    },
    questDesc: {
        color: '#8E8EA0',
        fontSize: 14,
        marginTop: 5,
        marginBottom: 15,
    },
    progressBarContainer: {
        height: 10,
        backgroundColor: '#333',
        borderRadius: 5,
        position: 'relative',
        justifyContent: 'center',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#6c5ce7',
        borderRadius: 5,
    },
    progressText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        position: 'absolute',
        right: 10,
        top: -15,
    },
    questOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    completedCheck: {
        color: '#4cd137',
        fontSize: 20,
        fontWeight: 'bold',
        textShadowColor: '#000',
        textShadowRadius: 10,
    },
});
