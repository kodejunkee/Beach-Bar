import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBarProps {
    isMyTurn: boolean;
    opponentConnected: boolean;
    turnNumber: number;
}

export default function GameStatusBar({ isMyTurn, opponentConnected, turnNumber }: StatusBarProps) {
    return (
        <View style={styles.container}>
            <View style={styles.left}>
                <View style={[styles.dot, isMyTurn ? styles.dotActive : styles.dotInactive]} />
                <Text style={[styles.turnText, isMyTurn && styles.turnTextActive]}>
                    {isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
                </Text>
            </View>
            <View style={styles.right}>
                {!opponentConnected && (
                    <Text style={styles.disconnectText}>⚠ Reconnecting…</Text>
                )}
                <Text style={styles.turnNumber}>Turn {turnNumber}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#12121F',
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    dotActive: {
        backgroundColor: '#2ECC71',
    },
    dotInactive: {
        backgroundColor: '#8E8EA0',
    },
    turnText: {
        color: '#8E8EA0',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
    },
    turnTextActive: {
        color: '#2ECC71',
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    disconnectText: {
        color: '#F1C40F',
        fontSize: 12,
        fontWeight: '600',
    },
    turnNumber: {
        color: '#5A5A72',
        fontSize: 13,
        fontWeight: '600',
    },
});
