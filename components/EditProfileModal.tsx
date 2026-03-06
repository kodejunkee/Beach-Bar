import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { getRankIcon } from '@/shared/types';

interface EditProfileModalProps {
    visible: boolean;
    currentUsername: string;
    profile: any;
    onSave: (newName: string) => void;
    onClose: () => void;
}

export default function EditProfileModal({ visible, currentUsername, profile, onSave, onClose }: EditProfileModalProps) {
    const [name, setName] = useState(currentUsername);
    const [isEditingName, setIsEditingName] = useState(false);

    useEffect(() => {
        if (visible) {
            setName(currentUsername);
            setIsEditingName(false);
        }
    }, [visible, currentUsername]);

    const handleSave = () => {
        const trimmed = name.trim();
        if (trimmed) {
            onSave(trimmed);
        }
        setIsEditingName(false);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Header with Title and Close */}
                    <View style={styles.modalHeader}>
                        <View style={styles.titleBanner}>
                            <Text style={styles.titleBannerText}>PROFILE</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Text style={styles.closeBtnText}>✖</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.mainContent}>
                        {/* 1. Avatar Section (Fixed Width) */}
                        <View style={styles.avatarContainer}>
                            <TouchableOpacity style={styles.avatarFrame} activeOpacity={0.9}>
                                <View style={styles.avatarInner}>
                                    <Text style={styles.avatarLetter}>{currentUsername.charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={styles.editIconBadge}>
                                    <Text style={styles.editIconText}>✎</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* 2. Middle Section (Stats & Name - Flex 1) */}
                        <View style={styles.statsContainer}>
                            <View style={styles.nameRow}>
                                {isEditingName ? (
                                    <TextInput
                                        style={styles.nameInput}
                                        value={name}
                                        onChangeText={setName}
                                        autoFocus
                                        maxLength={15}
                                        onBlur={handleSave}
                                        onSubmitEditing={handleSave}
                                    />
                                ) : (
                                    <TouchableOpacity style={styles.nameDisplayTray} onPress={() => setIsEditingName(true)}>
                                        <Text style={styles.profileName} numberOfLines={1}>{currentUsername}</Text>
                                        <Text style={styles.nameEditIcon}>✎</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.statsList}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statIcon}>⭐</Text>
                                    <Text style={styles.statLabel}>Ranked Points:</Text>
                                    <Text style={styles.statValue}>{profile?.ranked_points || 0}</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statIcon}>⚔️</Text>
                                    <Text style={styles.statLabel}>Player Title:</Text>
                                    <Text style={styles.statValue}>Novice</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statIcon}>🏆</Text>
                                    <Text style={styles.statLabel}>Achievements:</Text>
                                    <Text style={styles.statValue}>0</Text>
                                </View>
                            </View>
                        </View>

                        {/* 3. Rank Section (Fixed Width) */}
                        <View style={styles.rankContainer}>
                            <Text style={styles.rankIconBold}>{profile ? getRankIcon(profile.current_rank) : '?'}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 100,
    },
    card: {
        width: '95%',
        maxWidth: 600,
        backgroundColor: '#0A0A2E',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#00A8FF',
        padding: 4,
        overflow: 'hidden',
    },
    modalHeader: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 54,
        backgroundColor: '#00A8FF',
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
    },
    titleBanner: {
        backgroundColor: '#000',
        paddingHorizontal: 25,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#FFF',
    },
    titleBannerText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 3,
    },
    closeBtn: {
        position: 'absolute',
        right: 8,
        top: 8,
        width: 38,
        height: 38,
        backgroundColor: '#00A8FF',
        borderRadius: 6,
        borderWidth: 2.5,
        borderColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
    },
    mainContent: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#05051A',
        alignItems: 'center',
        gap: 10,
    },
    avatarContainer: {
        width: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarFrame: {
        width: 56,
        height: 56,
        borderRadius: 8,
        borderWidth: 2.5,
        borderColor: '#8E9AAF',
        backgroundColor: '#2A2A4A',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    avatarInner: {
        width: '100%',
        height: '100%',
        backgroundColor: '#3D3D5D',
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: {
        color: '#FFF',
        fontSize: 30,
        fontWeight: '900',
    },
    editIconBadge: {
        position: 'absolute',
        bottom: -3,
        right: -3,
        backgroundColor: '#FFF',
        width: 20,
        height: 20,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#00A8FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editIconText: {
        fontSize: 12,
        color: '#00A8FF',
    },
    statsContainer: {
        flex: 1,
        paddingHorizontal: 5,
    },
    nameRow: {
        marginBottom: 8,
    },
    nameDisplayTray: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    profileName: {
        color: '#00D2FF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    nameEditIcon: {
        fontSize: 14,
        color: '#00A8FF',
        opacity: 0.8,
    },
    nameInput: {
        color: '#00D2FF',
        fontSize: 18,
        fontWeight: '900',
        borderBottomWidth: 1,
        borderBottomColor: '#00D2FF',
        padding: 0,
    },
    statsList: {
        gap: 4,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statIcon: {
        fontSize: 14,
        width: 18,
    },
    statLabel: {
        color: '#8E9AAF',
        fontSize: 12,
        fontWeight: '700',
    },
    statValue: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '900',
    },
    rankContainer: {
        width: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankIconBold: {
        fontSize: 45,
    },
});
