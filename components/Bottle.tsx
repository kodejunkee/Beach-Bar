import React from 'react';
import { TouchableOpacity, StyleSheet, Image, View } from 'react-native';
import { BottleColor } from '@/shared/types';

// ─── Image Map ──────────────────────────────────────────────
const BOTTLE_IMAGES: Record<BottleColor, ReturnType<typeof require>> = {
    red: require('@/assets/images/bottles/red bottle.png'),
    blue: require('@/assets/images/bottles/blue bottle.png'),
    green: require('@/assets/images/bottles/green bottle.png'),
    yellow: require('@/assets/images/bottles/yellow bottle.png'),
    purple: require('@/assets/images/bottles/purple bottle.png'),
    orange: require('@/assets/images/bottles/orange bottle.png'),
};

interface BottleProps {
    color: BottleColor;
    index: number;
    selected: boolean;
    disabled: boolean;
    onPress: (index: number) => void;
}

export default function Bottle({ color, index, selected, disabled, onPress }: BottleProps) {
    return (
        <TouchableOpacity
            activeOpacity={disabled ? 1 : 0.85}
            onPress={() => !disabled && onPress(index)}
            style={[styles.touchable, selected && styles.selectedTouchable]}
            accessibilityLabel={`Bottle ${index + 1}: ${color}`}
            accessibilityRole="button"
        >
            {/* Selection glow ring */}
            {selected && <View style={styles.glowRing} />}
            <Image
                source={BOTTLE_IMAGES[color]}
                style={[
                    styles.image,
                    selected && styles.selectedImage,
                    disabled && styles.disabledImage,
                ]}
                resizeMode="contain"
            />
        </TouchableOpacity>
    );
}

const BOTTLE_W = 52;
const BOTTLE_H = 84;

const styles = StyleSheet.create({
    touchable: {
        width: BOTTLE_W,
        height: BOTTLE_H,
        marginHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    selectedTouchable: {
        // lift up slightly so bottle appears to "hover"
        transform: [{ translateY: -8 }],
    },
    glowRing: {
        position: 'absolute',
        bottom: -4,
        left: '10%',
        right: '10%',
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.45)',
    },
    image: {
        width: BOTTLE_W,
        height: BOTTLE_H,
    },
    selectedImage: {
        // subtle brightness boost handled by the translateY and glow
    },
    disabledImage: {
        opacity: 0.55,
    },
});
