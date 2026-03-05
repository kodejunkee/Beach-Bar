import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBarProps {
    roundNumber: number;
    opponentConnected: boolean;
}

export default function GameStatusBar({ roundNumber, opponentConnected }: StatusBarProps) {
    return (
        <View style={styles.container}>
            {!opponentConnected && (
                <Text style={styles.disconnectText}>⚠ Opponent reconnecting…</Text>
            )}
            <Text style={styles.roundText}>ROUND {roundNumber}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: '#12121F',
    },
    roundText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    },
    disconnectText: {
        color: '#F1C40F',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
});
