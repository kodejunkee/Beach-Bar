import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type InventoryItem = {
    id: string; // the shop_item id
    name: string;
    type: string;
    asset_url: string;
    acquired_at: string;
};

interface Props {
    visible: boolean;
    onClose: () => void;
}

export default function InventoryModal({ visible, onClose }: Props) {
    const { width } = useWindowDimensions();
    const PHONE_WIDTH = 390;
    const scaleFactor = Math.min(Math.max(width / PHONE_WIDTH, 1), 1.5);

    const { profile, refreshProfile } = useAuth();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [equipping, setEquipping] = useState<string | null>(null);

    useEffect(() => {
        if (visible && profile) {
            fetchInventory();
        }
    }, [visible, profile]);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            // Join user_inventory with shop_items
            const { data, error } = await supabase
                .from('user_inventory')
                .select(`
                    acquired_at,
                    item_id,
                    shop_items (
                        id,
                        name,
                        type,
                        asset_url
                    )
                `)
                .eq('user_id', profile!.id)
                .order('acquired_at', { ascending: false });

            if (error) throw error;

            const formatted: InventoryItem[] = (data || []).map(row => ({
                id: (row.shop_items as any).id,
                name: (row.shop_items as any).name,
                type: (row.shop_items as any).type,
                asset_url: (row.shop_items as any).asset_url,
                acquired_at: row.acquired_at
            }));

            setItems(formatted);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            Alert.alert('Error', 'Could not load your inventory.');
        } finally {
            setLoading(false);
        }
    };

    const handleEquip = async (itemId: string | null) => {
        setEquipping(itemId || 'unequip');
        try {
            const { data, error } = await supabase.rpc('equip_frame', {
                p_item_id: itemId
            });

            if (error) throw error;

            const result = typeof data === 'string' ? JSON.parse(data) : data;

            if (result.success) {
                await refreshProfile();
            } else {
                Alert.alert('Equip Failed', result.error);
            }
        } catch (err) {
            console.error('Equip error:', err);
            Alert.alert('Error', 'Failed to equip item.');
        } finally {
            setEquipping(null);
        }
    };

    const renderItem = ({ item }: { item: InventoryItem }) => {
        const isEquipped = profile?.equipped_frame === item.id;

        return (
            <View style={[styles.itemCard, isEquipped && styles.equippedCard]}>
                <View style={styles.itemIconContainer}>
                    <Text style={styles.itemEmoji}>{item.asset_url}</Text>
                </View>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemType}>{item.type.replace('_', ' ').toUpperCase()}</Text>
                </View>

                {isEquipped ? (
                    <TouchableOpacity
                        style={[styles.equipBtn, styles.unequipBtn]}
                        onPress={() => handleEquip(null)}
                        disabled={!!equipping}
                    >
                        {equipping === 'unequip' ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.equipBtnText}>UNEQUIP</Text>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.equipBtn}
                        onPress={() => handleEquip(item.id)}
                        disabled={!!equipping}
                    >
                        {equipping === item.id ? (
                            <ActivityIndicator size="small" color="#4A90E2" />
                        ) : (
                            <Text style={[styles.equipBtnText, { color: '#4A90E2' }]}>EQUIP</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { padding: 20 * scaleFactor }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { fontSize: 24 * scaleFactor }]}>My Inventory</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <FontAwesome5 name="times" size={24} color="#8E8EA0" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.centerBox}>
                            <ActivityIndicator size="large" color="#6C5CE7" />
                        </View>
                    ) : items.length === 0 ? (
                        <View style={styles.centerBox}>
                            <FontAwesome5 name="box-open" size={48} color="#4A4A5A" />
                            <Text style={styles.emptyText}>Your inventory is empty!</Text>
                            <Text style={styles.emptySub}>Visit the Shop to buy covers and frames.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={items}
                            keyExtractor={i => i.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.list}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1E1E28',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '80%',
        paddingTop: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        color: '#FFF',
        fontWeight: '900',
    },
    closeBtn: {
        padding: 4,
    },
    centerBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
    },
    emptySub: {
        color: '#8E8EA0',
        fontSize: 14,
        marginTop: 8,
    },
    list: {
        gap: 12,
        paddingBottom: 40,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    equippedCard: {
        borderColor: '#4A90E2',
        backgroundColor: 'rgba(74, 144, 226, 0.1)',
    },
    itemIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemEmoji: {
        fontSize: 32,
    },
    itemInfo: {
        flex: 1,
        marginLeft: 16,
    },
    itemName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    itemType: {
        color: '#8E8EA0',
        fontSize: 12,
        marginTop: 4,
    },
    equipBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#4A90E2',
        minWidth: 90,
        alignItems: 'center',
    },
    unequipBtn: {
        backgroundColor: '#4A90E2',
    },
    equipBtnText: {
        fontWeight: 'bold',
        fontSize: 12,
        color: '#FFF',
    },
});
