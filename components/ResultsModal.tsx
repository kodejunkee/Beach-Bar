import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { BottleColor } from '@/shared/types';
import Bottle from './Bottle';

interface ResultsModalProps {
    visible: boolean;
    winnerId: string | null;
    myPlayerId: string | null;
    reason: 'solved' | 'forfeit' | 'surrender';
    solution: BottleColor[];
    onPlayAgain: () => void;
}

// Derive what to show based on who won and why
function getResultContent(
    isWinner: boolean,
    reason: ResultsModalProps['reason']
): { emoji: string; title: string; subtitle: string; titleStyle: 'win' | 'lose' | 'neutral' } {
    if (reason === 'surrender') {
        if (isWinner) {
            return {
                emoji: '🏳️',
                title: 'Opponent Surrendered',
                subtitle: 'You win by default!',
                titleStyle: 'win',
            };
        } else {
            return {
                emoji: '🏳️',
                title: 'You Surrendered',
                subtitle: 'Opponent wins this round.',
                titleStyle: 'lose',
            };
        }
    }

    if (reason === 'forfeit') {
        if (isWinner) {
            return {
                emoji: '🔌',
                title: 'Opponent Disconnected',
                subtitle: 'You win by forfeit.',
                titleStyle: 'win',
            };
        } else {
            return {
                emoji: '🔌',
                title: 'You Were Disconnected',
                subtitle: 'Opponent wins.',
                titleStyle: 'lose',
            };
        }
    }

    // 'solved'
    if (isWinner) {
        return {
            emoji: '🎉',
            title: 'You Cracked the Code!',
            subtitle: 'Great deduction!',
            titleStyle: 'win',
        };
    } else {
        return {
            emoji: '😔',
            title: 'Opponent Solved It',
            subtitle: 'Better luck next time.',
            titleStyle: 'lose',
        };
    }
}

export default function ResultsModal({
    visible,
    winnerId,
    myPlayerId,
    reason,
    solution,
    onPlayAgain,
}: ResultsModalProps) {
    const isWinner = winnerId === myPlayerId;
    const { emoji, title, subtitle, titleStyle } = getResultContent(isWinner, reason);

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Result Header */}
                    <Text style={styles.emoji}>{emoji}</Text>
                    <Text style={[
                        styles.title,
                        titleStyle === 'win' ? styles.winTitle : styles.loseTitle,
                    ]}>
                        {title}
                    </Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>

                    {/* Solution Reveal */}
                    <Text style={styles.solutionLabel}>THE SOLUTION</Text>
                    <View style={styles.solutionRow}>
                        {solution.map((color, index) => (
                            <Bottle
                                key={index}
                                color={color}
                                index={index}
                                selected={false}
                                disabled={true}
                                onPress={() => { }}
                            />
                        ))}
                    </View>

                    {/* Play Again */}
                    <TouchableOpacity style={styles.button} onPress={onPlayAgain} activeOpacity={0.8}>
                        <Text style={styles.buttonText}>Play Again</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#1A1A2E',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 380,
    },
    emoji: {
        fontSize: 56,
        marginBottom: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 4,
    },
    winTitle: {
        color: '#2ECC71',
    },
    loseTitle: {
        color: '#E74C3C',
    },
    subtitle: {
        color: '#8E8EA0',
        fontSize: 14,
        marginBottom: 24,
    },
    solutionLabel: {
        color: '#5A5A72',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 2,
        marginBottom: 12,
    },
    solutionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 28,
    },
    button: {
        backgroundColor: '#6C5CE7',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 14,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
