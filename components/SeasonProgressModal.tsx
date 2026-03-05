import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getRankIcon, RANKS, RankTier, getRankFromRp } from '@/shared/types';

interface SeasonProgressModalProps {
    visible: boolean;
    onClose: () => void;
    currentRank?: string;
    currentRp?: number;
}


export default function SeasonProgressModal({ visible, onClose, currentRank, currentRp }: SeasonProgressModalProps) {
    const renderItem = ({ item }: { item: RankTier }) => {
        // Use currentRp to determine the highlight if available, otherwise fallback to currentRank name
        const effectiveRank = currentRp !== undefined ? getRankFromRp(currentRp) : currentRank;
        const isCurrentRank = item.name === effectiveRank;

        return (
            <View style={[
                styles.rankItem,
                isCurrentRank && styles.currentRankItem
            ]}>
                <View style={styles.rankIconContainer}>
                    <Text style={styles.rankIconText}>{getRankIcon(item.name)}</Text>
                </View>

                <View style={styles.rankInfo}>
                    <Text style={[
                        styles.rankName,
                        isCurrentRank && styles.currentText
                    ]}>
                        {item.name}
                    </Text>
                    <Text style={styles.rangeText}>{item.range}</Text>
                </View>

                {isCurrentRank && (
                    <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>YOU</Text>
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
                <SafeAreaView style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Season Progress</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={28} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={[...RANKS].reverse()}
                        renderItem={renderItem}
                        keyExtractor={item => item.name}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        color: '#FFD700',
        fontSize: 24,
        fontWeight: 'bold',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 20,
    },
    rankItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 15,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    currentRankItem: {
        backgroundColor: 'rgba(46, 204, 113, 0.2)',
        borderColor: '#2ecc71',
    },
    rankIconContainer: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankIconText: {
        fontSize: 24,
    },
    rankInfo: {
        flex: 1,
        marginLeft: 15,
    },
    rankName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    currentText: {
        color: '#2ecc71',
    },
    rangeText: {
        color: '#8E8EA0',
        fontSize: 13,
        marginTop: 2,
    },
    currentBadge: {
        backgroundColor: '#2ecc71',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    currentBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
