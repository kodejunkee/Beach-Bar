import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView } from 'react-native';
import { BottleColor, GameOverRewards } from '@/shared/types';
import Bottle from './Bottle';

interface ResultsModalProps {
    visible: boolean;
    winnerId: string | null;
    myPlayerId: string | null;
    reason: 'solved' | 'forfeit' | 'surrender';
    solution: BottleColor[];
    onPlayAgain: () => void;
    isRanked?: boolean;
    rewards?: GameOverRewards | null;
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

    // Default to 'solved' logic
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
    isRanked,
    rewards,
}: ResultsModalProps) {
    const isWinner = winnerId === myPlayerId;
    const { emoji, title, subtitle, titleStyle } = getResultContent(isWinner, reason);

    return (
        <Modal visible={visible} transparent animationType="fade">
            <SafeAreaView style={styles.overlay}>
                {/* Top Section: Result & Rewards */}
                <View style={styles.topContainer}>
                    <View style={styles.card}>
                        <Text style={styles.emoji}>{emoji}</Text>
                        <Text style={[
                            styles.title,
                            titleStyle === 'win' ? styles.winTitle : styles.loseTitle,
                        ]}>
                            {title}
                        </Text>
                        <Text style={styles.subtitle}>{subtitle}</Text>

                        {rewards && typeof rewards === 'object' && (
                            <View style={styles.rewardContainer}>
                                <View style={styles.rewardRow}>
                                    {(rewards.exp !== undefined && rewards.exp !== null) && (
                                        <View style={styles.rewardItem}>
                                            <Text style={styles.rewardValue}>+ {typeof rewards.exp === 'number' ? rewards.exp : 0}</Text>
                                            <Text style={styles.rewardLabel}>EXP</Text>
                                        </View>
                                    )}
                                    {(rewards.gold !== undefined && rewards.gold !== null) && (
                                        <View style={styles.rewardItem}>
                                            <Text style={styles.rewardValue}>+ {typeof rewards.gold === 'number' ? rewards.gold : 0}</Text>
                                            <Text style={styles.rewardLabel}>GOLD</Text>
                                        </View>
                                    )}
                                    {isRanked && rewards.rpChange !== undefined && rewards.rpChange !== null && (
                                        <View style={styles.rewardItem}>
                                            <Text style={[
                                                styles.rewardValue,
                                                (typeof rewards.rpChange === 'number' && rewards.rpChange >= 0) ? styles.positiveRp : styles.negativeRp
                                            ]}>
                                                {typeof rewards.rpChange === 'number' ? (rewards.rpChange >= 0 ? `+${rewards.rpChange}` : rewards.rpChange) : '0'}
                                            </Text>
                                            <Text style={styles.rewardLabel}>RP</Text>
                                        </View>
                                    )}
                                </View>

                                {rewards.leveledUp && rewards.newLevel !== undefined && (
                                    <View style={styles.milestoneBadge}>
                                        <Text style={styles.milestoneText}>UPGRADED TO LEVEL {rewards.newLevel}!</Text>
                                    </View>
                                )}

                                {isRanked && rewards.rankChanged && rewards.newRank && (
                                    <View style={[
                                        styles.milestoneBadge,
                                        rewards.rankChanged === 'promoted' ? styles.promoteBadge : styles.demoteBadge
                                    ]}>
                                        <Text style={styles.milestoneText}>
                                            {rewards.rankChanged === 'promoted' ? 'PROMOTED' : 'DEMOTED'} TO {rewards.newRank}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </View>

                {/* Middle Section: SPACER to see the board */}
                <View style={styles.middleSpacer} pointerEvents="none" />

                {/* Bottom Section: Solution & Navigation */}
                <View style={styles.bottomContainer}>
                    <View style={styles.card}>
                        {solution && Array.isArray(solution) && solution.length > 0 && (
                            <>
                                <Text style={styles.solutionLabel}>THE SOLUTION</Text>
                                <View style={styles.solutionRow}>
                                    {solution.map((color, index) => {
                                        if (!color) return null;
                                        return (
                                            <Bottle
                                                key={index}
                                                color={color}
                                                index={index}
                                                selected={false}
                                                disabled={true}
                                                onPress={() => { }}
                                            />
                                        );
                                    })}
                                </View>
                            </>
                        )}

                        <TouchableOpacity style={styles.button} onPress={onPlayAgain} activeOpacity={0.8}>
                            <Text style={styles.buttonText}>Continue</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'space-between',
    },
    topContainer: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 20,
    },
    bottomContainer: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 20,
    },
    middleSpacer: {
        flex: 1,
    },
    card: {
        backgroundColor: '#1A1A2E',
        borderRadius: 24,
        paddingHorizontal: 28,
        paddingVertical: 24,
        alignItems: 'center',
        width: '90%',
        maxWidth: 360,
        borderWidth: 2,
        borderColor: '#30304A',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    emoji: {
        fontSize: 40,
        marginBottom: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    winTitle: {
        color: '#FFD700',
    },
    loseTitle: {
        color: '#E74C3C',
    },
    subtitle: {
        color: '#A0A0B8',
        fontSize: 13,
        marginBottom: 16,
        textAlign: 'center',
    },
    rewardContainer: {
        width: '100%',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    rewardRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    rewardItem: {
        alignItems: 'center',
    },
    rewardValue: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
    },
    rewardLabel: {
        color: '#5A5A72',
        fontSize: 10,
        fontWeight: '800',
        marginTop: 2,
    },
    positiveRp: {
        color: '#2ECC71',
    },
    negativeRp: {
        color: '#E74C3C',
    },
    milestoneBadge: {
        marginTop: 10,
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    promoteBadge: {
        backgroundColor: 'rgba(46, 204, 113, 0.15)',
        borderColor: 'rgba(46, 204, 113, 0.3)',
    },
    demoteBadge: {
        backgroundColor: 'rgba(231, 76, 60, 0.15)',
        borderColor: 'rgba(231, 76, 60, 0.3)',
    },
    milestoneText: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: '900',
        textAlign: 'center',
    },
    solutionLabel: {
        color: '#5A5A72',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 3,
        marginBottom: 12,
    },
    solutionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
        // Scaling slightly to ensure 6 bottles fit compactly
        transform: [{ scale: 0.9 }],
    },
    button: {
        backgroundColor: '#7B3F00',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#D4A76A',
    },
    buttonText: {
        color: '#F4E9D8',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
});
