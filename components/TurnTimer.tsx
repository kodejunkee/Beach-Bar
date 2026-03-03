import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface TurnTimerProps {
    turnDeadline: number;
    turnDuration: number; // ms, e.g. 15000
    isMyTurn: boolean;
}

export default function TurnTimer({ turnDeadline, turnDuration, isMyTurn }: TurnTimerProps) {
    const [remaining, setRemaining] = useState(() => {
        const diff = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
        return diff;
    });
    const pulseAnim = useRef(new Animated.Value(1)).current;
    // Track the max seconds seen for this deadline (used for progress bar)
    const maxSeenRef = useRef(remaining);

    // Recompute max and remaining whenever deadline changes
    useEffect(() => {
        const initialRemaining = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
        const maxFromDuration = Math.round(turnDuration / 1000);
        maxSeenRef.current = Math.max(initialRemaining, maxFromDuration);
        setRemaining(initialRemaining);

        const interval = setInterval(() => {
            const now = Date.now();
            const diff = Math.max(0, Math.ceil((turnDeadline - now) / 1000));
            setRemaining(diff);
            if (diff <= 0) clearInterval(interval);
        }, 100);

        return () => clearInterval(interval);
    }, [turnDeadline, turnDuration]);

    // Pulse animation when ≤3 seconds
    useEffect(() => {
        if (remaining <= 3 && remaining > 0) {
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.15, duration: 200, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        }
    }, [remaining]);

    const maxSeconds = maxSeenRef.current || Math.round(turnDuration / 1000);
    const barWidth = Math.max(0, (remaining / maxSeconds) * 100);
    const barColor = remaining > 5 ? '#2ECC71' : remaining > 3 ? '#F1C40F' : '#E74C3C';

    return (
        <View style={styles.container}>
            <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
            </View>
            <Animated.Text
                style={[styles.timerText, { color: barColor, transform: [{ scale: pulseAnim }] }]}
            >
                {remaining > 0 ? `${remaining}s` : "Time's up!"}
            </Animated.Text>
            <Text style={styles.label}>
                {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    barBackground: {
        width: '100%',
        height: 8,
        backgroundColor: '#2A2A3E',
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: 4,
    },
    timerText: {
        fontSize: 28,
        fontWeight: '800',
        marginTop: 8,
    },
    label: {
        fontSize: 14,
        color: '#8E8EA0',
        marginTop: 4,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
