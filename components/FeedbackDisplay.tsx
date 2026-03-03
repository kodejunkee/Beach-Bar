import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feedback } from '@/shared/types';

interface FeedbackDisplayProps {
    myFeedback: Feedback | null;
    opponentFeedback: Feedback | null;
}

export default function FeedbackDisplay({ myFeedback, opponentFeedback }: FeedbackDisplayProps) {
    if (!myFeedback && !opponentFeedback) return null;

    return (
        <View style={styles.container}>
            {myFeedback && (
                <View style={styles.feedbackRow}>
                    <Text style={styles.label}>You</Text>
                    <View style={styles.badges}>
                        <View style={[styles.badge, styles.correctBadge]}>
                            <Text style={styles.badgeText}>✓ {myFeedback.correct}</Text>
                        </View>
                        <View style={[styles.badge, styles.incorrectBadge]}>
                            <Text style={styles.badgeText}>✗ {myFeedback.incorrect}</Text>
                        </View>
                    </View>
                </View>
            )}
            {opponentFeedback && (
                <View style={styles.feedbackRow}>
                    <Text style={styles.label}>Opponent</Text>
                    <View style={styles.badges}>
                        <View style={[styles.badge, styles.correctBadge]}>
                            <Text style={styles.badgeText}>✓ {opponentFeedback.correct}</Text>
                        </View>
                        <View style={[styles.badge, styles.incorrectBadge]}>
                            <Text style={styles.badgeText}>✗ {opponentFeedback.incorrect}</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 8,
    },
    feedbackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1A1A2E',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    label: {
        color: '#8E8EA0',
        fontSize: 14,
        fontWeight: '600',
    },
    badges: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    correctBadge: {
        backgroundColor: 'rgba(46, 204, 113, 0.2)',
    },
    incorrectBadge: {
        backgroundColor: 'rgba(231, 76, 60, 0.2)',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
