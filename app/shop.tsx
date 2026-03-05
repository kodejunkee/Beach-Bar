import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, FlatList, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { FontAwesome5 } from '@expo/vector-icons';

const BG_IMAGE = require('@/assets/images/backgrounds/main screen background.png');

type ShopItem = {
    id: string;
    name: string;
    type: string;
    cost_type: 'gold' | 'diamonds';
    cost_amount: number;
    asset_url: string;
    owned?: boolean;
};

export default function ShopScreen() {
    const { width } = useWindowDimensions();
    const PHONE_WIDTH = 390;
    const scaleFactor = Math.min(Math.max(width / PHONE_WIDTH, 1), 1.5);

    const { profile, refreshProfile } = useAuth();
    const [items, setItems] = useState<ShopItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);

    useEffect(() => {
        fetchShopItems();
    }, [profile]);

    const fetchShopItems = async () => {
        if (!profile) return;
        setLoading(true);

        try {
            // Fetch all shop items
            const { data: shopData, error: shopError } = await supabase
                .from('shop_items')
                .select('*')
                .order('cost_type', { ascending: false })
                .order('cost_amount', { ascending: true });

            if (shopError) throw shopError;

            // Fetch user inventory to mark owned items
            const { data: invData, error: invError } = await supabase
                .from('user_inventory')
                .select('item_id')
                .eq('user_id', profile.id);

            if (invError) throw invError;

            const ownedIds = new Set(invData?.map(row => row.item_id) || []);

            const processedItems: ShopItem[] = (shopData || []).map(item => ({
                ...item,
                owned: ownedIds.has(item.id),
            }));

            setItems(processedItems);
        } catch (error) {
            console.error('Error fetching shop:', error);
            Alert.alert('Error', 'Failed to load shop items.');
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (item: ShopItem) => {
        if (item.owned) return;

        if (item.cost_type === 'gold' && (profile?.gold || 0) < item.cost_amount) {
            Alert.alert('Not enough Gold', 'You need more gold to buy this item.');
            return;
        }

        if (item.cost_type === 'diamonds' && (profile?.diamonds || 0) < item.cost_amount) {
            Alert.alert('Not enough Diamonds', 'You need more diamonds to buy this item.');
            return;
        }

        Alert.alert(
            'Confirm Purchase',
            `Buy ${item.name} for ${item.cost_amount} ${item.cost_type}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Buy',
                    onPress: async () => {
                        setPurchasing(item.id);
                        try {
                            const { data, error } = await supabase.rpc('purchase_item', {
                                p_item_id: item.id
                            });

                            if (error) throw error;

                            // data is returned as JSONB which is parsed into an object
                            const result = typeof data === 'string' ? JSON.parse(data) : data;

                            if (result.success) {
                                await fetchShopItems(); // Refresh store list
                                await refreshProfile(); // Refresh balances
                                Alert.alert('Success!', `You bought ${item.name}!`);
                            } else {
                                Alert.alert('Purchase Failed', result.error || 'Unknown error');
                            }
                        } catch (err: any) {
                            console.error('Purchase error:', err);
                            Alert.alert('Error', 'An error occurred during purchase.');
                        } finally {
                            setPurchasing(null);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: ShopItem }) => (
        <View style={styles.itemCard}>
            <View style={styles.itemIconContainer}>
                <Text style={styles.itemEmoji}>{item.asset_url}</Text>
            </View>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemType}>
                    {item.type.replace('_', ' ').toUpperCase()}
                </Text>

                {item.owned ? (
                    <View style={[styles.buyButton, styles.ownedButton]}>
                        <Text style={styles.ownedText}>OWNED</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[
                            styles.buyButton,
                            item.cost_type === 'diamonds' && styles.diamondBuyBtn
                        ]}
                        onPress={() => handlePurchase(item)}
                        disabled={purchasing === item.id}
                        activeOpacity={0.8}
                    >
                        {purchasing === item.id ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <View style={styles.costRow}>
                                <Text style={styles.buyButtonText}>{item.cost_amount}</Text>
                                <Text style={{ fontSize: 16 }}>{item.cost_type === 'gold' ? '🪙' : '💎'}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <ImageBackground source={BG_IMAGE} style={styles.container} resizeMode="cover">
            <View style={[styles.overlay, { padding: 20 * scaleFactor }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <FontAwesome5 name="arrow-left" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { fontSize: 24 * scaleFactor }]}>Shop</Text>
                    {/* Spacer */}
                    <View style={{ width: 40 }} />
                </View>

                {/* Balances */}
                <View style={styles.balancesContainer}>
                    <View style={styles.balanceBadge}>
                        <Text style={styles.balanceText}>{profile?.gold || 0}</Text>
                        <Text style={styles.balanceIcon}>🪙</Text>
                    </View>
                    <View style={styles.balanceBadge}>
                        <Text style={styles.balanceText}>{profile?.diamonds || 0}</Text>
                        <Text style={styles.balanceIcon}>💎</Text>
                    </View>
                </View>

                {/* Items List */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#FFD700" />
                        <Text style={styles.loadingText}>Loading items...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={item => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#FFF',
        fontWeight: '900',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    balancesContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 20,
    },
    balanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    balanceText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 6,
    },
    balanceIcon: {
        fontSize: 18,
    },
    listContent: {
        paddingBottom: 40,
        gap: 16,
    },
    itemCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(30,30,40,0.9)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    itemIconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    itemEmoji: {
        fontSize: 40,
    },
    itemInfo: {
        flex: 1,
        marginLeft: 16,
    },
    itemName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    itemType: {
        color: '#8E8EA0',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 12,
    },
    buyButton: {
        backgroundColor: '#D4AF37', // Gold color
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#FFD700',
        minWidth: 100,
    },
    diamondBuyBtn: {
        backgroundColor: '#4A90E2', // Blue for diamonds
        borderColor: '#5DADE2',
    },
    ownedButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderColor: 'rgba(255,255,255,0.2)',
    },
    costRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    buyButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    ownedText: {
        color: '#A0A0B0',
        fontSize: 14,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#FFF',
        marginTop: 12,
        fontSize: 16,
    },
});
