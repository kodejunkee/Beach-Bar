import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ImageBackground } from 'react-native';

interface EditProfileModalProps {
    visible: boolean;
    currentUsername: string;
    onSave: (newName: string) => void;
    onClose: () => void;
}

const PARCHMENT_BG = require('@/assets/images/UI/frames/lobby code background.png');

export default function EditProfileModal({ visible, currentUsername, onSave, onClose }: EditProfileModalProps) {
    const [name, setName] = useState(currentUsername);

    useEffect(() => {
        if (visible) {
            setName(currentUsername);
        }
    }, [visible, currentUsername]);

    const handleSave = () => {
        const trimmed = name.trim();
        if (trimmed) {
            onSave(trimmed);
        }
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <ImageBackground source={PARCHMENT_BG} style={styles.card} resizeMode="contain">
                    <View style={styles.content}>
                        <Text style={styles.title}>Edit Profile</Text>

                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter username"
                            placeholderTextColor="#A08C75"
                            maxLength={15}
                            autoCorrect={false}
                            autoCapitalize="words"
                        />

                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
                                onPress={handleSave}
                                disabled={!name.trim()}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.saveText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ImageBackground>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 10, 20, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        width: 340,
        height: 380,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        width: '100%',
        paddingHorizontal: 54,
        paddingTop: 80,
        paddingBottom: 60,
        alignItems: 'center',
        gap: 20,
    },
    title: {
        color: '#5C3D1A',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 2,
    },
    input: {
        backgroundColor: 'rgba(92, 61, 26, 0.08)',
        borderColor: '#8A6338',
        borderWidth: 2,
        borderRadius: 12,
        color: '#5C3D1A',
        fontSize: 18,
        fontWeight: '700',
        paddingHorizontal: 20,
        paddingVertical: 12,
        width: '100%',
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        justifyContent: 'center',
        marginTop: 10,
    },
    cancelBtn: {
        backgroundColor: 'rgba(92, 61, 26, 0.1)',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    cancelText: {
        color: '#8A6338',
        fontSize: 15,
        fontWeight: '700',
    },
    saveBtn: {
        backgroundColor: '#2ECC71',
        paddingVertical: 12,
        paddingHorizontal: 28,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    saveBtnDisabled: {
        opacity: 0.5,
    },
    saveText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
});
