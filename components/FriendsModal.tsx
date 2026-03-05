import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth, UserProfile } from '@/context/AuthContext';

interface FriendsModalProps {
    visible: boolean;
    onClose: () => void;
}

type FriendRecord = {
    id: string;
    status: 'pending' | 'accepted' | 'blocked';
    friend_profile: UserProfile;
};

export default function FriendsModal({ visible, onClose }: FriendsModalProps) {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends');
    const [friends, setFriends] = useState<FriendRecord[]>([]);
    const [requests, setRequests] = useState<FriendRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // Add Friend State
    const [searchUsername, setSearchUsername] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (visible && profile) {
            fetchSocialData();
        }
    }, [visible, profile]);

    const fetchSocialData = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            // Fetch accepted friends
            const { data: friendsData, error: friendsError } = await supabase
                .from('friendships')
                .select(`
                    id,
                    status,
                    user_id,
                    friend_id,
                    sender:profiles!user_id(*),
                    receiver:profiles!friend_id(*)
                `)
                .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`)
                .eq('status', 'accepted');

            if (friendsError) throw friendsError;

            const mappedFriends = friendsData.map(item => {
                const friendProfile = item.user_id === profile.id ? item.receiver : item.sender;
                return {
                    id: item.id,
                    status: item.status,
                    friend_profile: friendProfile as unknown as UserProfile
                };
            });
            setFriends(mappedFriends);

            // Fetch pending requests (received by me)
            const { data: requestsData, error: requestsError } = await supabase
                .from('friendships')
                .select(`
                    id,
                    status,
                    user_id,
                    friend_id,
                    sender:profiles!user_id(*)
                `)
                .eq('friend_id', profile.id)
                .eq('status', 'pending');

            if (requestsError) throw requestsError;

            const mappedRequests = requestsData.map(item => ({
                id: item.id,
                status: item.status,
                friend_profile: item.sender as unknown as UserProfile
            }));
            setRequests(mappedRequests);

        } catch (err) {
            console.error('Error fetching social data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async () => {
        if (!searchUsername.trim()) return;
        setIsSearching(true);
        try {
            const { data, error } = await supabase.rpc('send_friend_request', {
                target_username: searchUsername.trim()
            });

            if (error) throw error;

            if (data.success) {
                Alert.alert('Success', 'Friend request sent!');
                setSearchUsername('');
                setActiveTab('friends');
            } else {
                Alert.alert('Error', data.error || 'Failed to send request');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'An unexpected error occurred');
        } finally {
            setIsSearching(false);
        }
    };

    const handleRequestAction = async (requestId: string, action: 'accepted' | 'declined') => {
        try {
            const { data, error } = await supabase.rpc('handle_friend_request', {
                request_id: requestId,
                action: action
            });

            if (error) throw error;

            if (data.success) {
                fetchSocialData();
            } else {
                Alert.alert('Error', data.error || 'Failed to handle request');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'An unexpected error occurred');
        }
    };

    const renderFriendItem = ({ item }: { item: FriendRecord }) => {
        const isOnline = item.friend_profile.last_seen
            ? (new Date().getTime() - new Date(item.friend_profile.last_seen).getTime()) < 300000 // 5 minutes
            : false;

        return (
            <View style={styles.listItem}>
                <View style={styles.profileCircle}>
                    <Text style={styles.profileInitial}>
                        {item.friend_profile.username.charAt(0).toUpperCase()}
                    </Text>
                    {isOnline && <View style={styles.onlineBadge} />}
                </View>
                <View style={styles.itemInfo}>
                    <Text style={styles.usernameText}>{item.friend_profile.username}</Text>
                    <Text style={styles.levelText}>
                        Level {item.friend_profile.level} • {isOnline ? 'Online' : 'Offline'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.challengeBtn}
                    onPress={() => Alert.alert('Challenge', 'Challenging specialized for Phase 4 expansion!')}
                >
                    <Text style={styles.challengeText}>Challenge</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderRequestItem = ({ item }: { item: FriendRecord }) => (
        <View style={styles.listItem}>
            <View style={[styles.profileCircle, { backgroundColor: '#6c5ce7' }]}>
                <Text style={styles.profileInitial}>
                    {item.friend_profile.username.charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={styles.itemInfo}>
                <Text style={styles.usernameText}>{item.friend_profile.username}</Text>
                <Text style={styles.requestSubtext}>wants to be friends</Text>
            </View>
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.smallActionBtn, { backgroundColor: '#4cd137' }]}
                    onPress={() => handleRequestAction(item.id, 'accepted')}
                >
                    <Text style={styles.actionBtnText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.smallActionBtn, { backgroundColor: '#e84118' }]}
                    onPress={() => handleRequestAction(item.id, 'declined')}
                >
                    <Text style={styles.actionBtnText}>×</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Social Hub</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
                            onPress={() => setActiveTab('friends')}
                        >
                            <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
                                Friends ({friends.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
                            onPress={() => setActiveTab('requests')}
                        >
                            <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                                Requests {requests.length > 0 && `(${requests.length})`}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'add' && styles.activeTab]}
                            onPress={() => setActiveTab('add')}
                        >
                            <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>
                                Add
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View style={styles.listContainer}>
                        {loading && <ActivityIndicator color="#6c5ce7" style={{ marginTop: 20 }} />}

                        {activeTab === 'friends' && (
                            <FlatList
                                data={friends}
                                renderItem={renderFriendItem}
                                keyExtractor={item => item.id}
                                ListEmptyComponent={
                                    !loading ? <Text style={styles.emptyText}>No friends yet. Add some!</Text> : null
                                }
                            />
                        )}

                        {activeTab === 'requests' && (
                            <FlatList
                                data={requests}
                                renderItem={renderRequestItem}
                                keyExtractor={item => item.id}
                                ListEmptyComponent={
                                    !loading ? <Text style={styles.emptyText}>No pending requests.</Text> : null
                                }
                            />
                        )}

                        {activeTab === 'add' && (
                            <View style={styles.addSection}>
                                <Text style={styles.addTitle}>Add Friend</Text>
                                <Text style={styles.addSubitle}>Enter your friend's exact username to send a request.</Text>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Username"
                                    placeholderTextColor="#888"
                                    value={searchUsername}
                                    onChangeText={setSearchUsername}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    style={styles.sendBtn}
                                    onPress={handleSendRequest}
                                    disabled={isSearching}
                                >
                                    {isSearching ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.sendBtnText}>Send Request</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
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
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxHeight: '80%',
        backgroundColor: '#1e1e1e',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        color: '#FFF',
        fontSize: 24,
        marginTop: -2,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    tab: {
        flex: 1,
        paddingVertical: 15,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#6c5ce7',
    },
    tabText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
    },
    activeTabText: {
        color: '#FFF',
    },
    listContainer: {
        flex: 1,
        minHeight: 300,
        padding: 10,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        marginBottom: 10,
    },
    profileCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileInitial: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4cd137',
        borderWidth: 2,
        borderColor: '#1e1e1e',
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
        color: '#888',
        fontSize: 12,
        marginTop: 2,
    },
    requestSubtext: {
        color: '#6c5ce7',
        fontSize: 12,
        marginTop: 2,
    },
    challengeBtn: {
        backgroundColor: 'rgba(108, 92, 231, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#6c5ce7',
    },
    challengeText: {
        color: '#6c5ce7',
        fontSize: 12,
        fontWeight: 'bold',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    smallActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
    addSection: {
        padding: 20,
    },
    addTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    addSubitle: {
        color: '#888',
        fontSize: 14,
        marginBottom: 20,
    },
    searchInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        padding: 15,
        color: '#FFF',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 20,
    },
    sendBtn: {
        backgroundColor: '#6c5ce7',
        borderRadius: 10,
        padding: 15,
        alignItems: 'center',
    },
    sendBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
