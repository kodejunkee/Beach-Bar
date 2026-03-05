import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/context/AuthContext';
import { getRankIcon } from '@/shared/types';

interface LeaderboardModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function LeaderboardModal({ visible, onClose }: LeaderboardModalProps) {
    const [topPlayers, setTopPlayers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchLeaderboard();
        }
    }, [visible]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('rp', { ascending: false })
                .limit(20);

            if (error) throw error;
            if (data) setTopPlayers(data as UserProfile[]);
        } catch (err) {
            console.error('Error fetching leaderboard:', err);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item, index }: { item: UserProfile; index: number }) => (
        <View style={styles.listItem}>
            <Text style={styles.rankText}>{index + 1}</Text>
            <View style={styles.profileCircle}>
                <Text style={styles.profileInitial}>
                    {item.username.charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={styles.itemInfo}>
                <Text style={styles.usernameText}>{item.username}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.levelText}>Level {item.level}</Text>
                    <View style={styles.rankMiniBadge}>
                        <Text style={styles.rankMiniText}>
                            {getRankIcon(item.current_rank)} {item.current_rank || 'Bronze V'}
                        </Text>
                    </View>
                </View>
            </View>
            <View style={styles.expContainer}>
                <Text style={styles.expText}>{item.rp || 0} RP</Text>
            </View>
        </View>
    );

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
                        <Text style={styles.headerTitle}>Seasonal Rankings</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View style={styles.listContainer}>
                        {loading ? (
                            <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
                        ) : (
                            <FlatList
                                data={topPlayers}
                                renderItem={renderItem}
                                keyExtractor={item => item.id}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>No rankings found.</Text>
                                }
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
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxHeight: '85%',
        backgroundColor: '#1a1a2e',
        borderRadius: 25,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        color: '#FFD700',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 1,
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
    listContainer: {
        flex: 1,
        padding: 10,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 15,
        marginBottom: 8,
    },
    rankText: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: '900',
        width: 30,
        textAlign: 'center',
    },
    profileCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#6c5ce7',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    profileInitial: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    itemInfo: {
        flex: 1,
        marginLeft: 15,
    },
    usernameText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    levelText: {
        color: '#8E8EA0',
        fontSize: 12,
        marginTop: 2,
    },
    expContainer: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    expText: {
        color: '#F1C40F',
        fontSize: 13,
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
    rankMiniBadge: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        marginLeft: 8,
    },
    rankMiniText: {
        color: '#8E8EA0',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
