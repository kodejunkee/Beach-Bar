import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions, Animated, Easing } from 'react-native';
import Bottle from './Bottle';
import { BottleColor } from '@/shared/types';

const SHELF_IMAGE = require('@/assets/images/backgrounds/shelf.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Let the shelf take up most of the screen width, up to a sensible max
const SHELF_WIDTH = Math.min(SCREEN_WIDTH * 0.9, 360);

// The uncropped image has an aspect ratio of 1.18
const FULL_SHELF_HEIGHT = SHELF_WIDTH * 1.18;
// We only want the top 75% of the image visible
const CONTAINER_HEIGHT = FULL_SHELF_HEIGHT * 0.75;
// The ledge sits at 46% of the full height
const SHELF_TOP_LEDGE_PERCENT = 0.46;
// Full horizontal slot width each bottle occupies (image width + both margins)
const BOTTLE_SLOT_W = 52 + 6; // 52px image + 3px margin each side

interface BoardProps {
    bottles: BottleColor[];
    disabled: boolean;
    hasSwapped: boolean;
    onSwap: (index1: number, index2: number) => void;
}

export default function Board({ bottles, disabled, hasSwapped, onSwap }: BoardProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    // ─── Optimistic local display board ─────────────────────
    const [displayBottles, setDisplayBottles] = useState<BottleColor[]>(bottles);

    const pendingSwapRef = useRef(false);

    useEffect(() => {
        if (isAnimating) return;
        if (pendingSwapRef.current) {
            pendingSwapRef.current = false;
            return;
        }
        setDisplayBottles(bottles);
    }, [bottles, isAnimating]);

    // ─── Intro animation refs ───────────────────────────────
    const hasPlayedIntro = useRef(false);
    const shelfSlideY = useRef(new Animated.Value(300)).current;
    const bottleDropAnims = useRef<Animated.Value[]>([]);
    const bottleOpacityAnims = useRef<Animated.Value[]>([]);

    // Ensure we have one anim value per bottle
    if (bottleDropAnims.current.length !== bottles.length) {
        bottleDropAnims.current = bottles.map(
            (_, i) => bottleDropAnims.current[i] ?? new Animated.Value(-120)
        );
        bottleOpacityAnims.current = bottles.map(
            (_, i) => bottleOpacityAnims.current[i] ?? new Animated.Value(0)
        );
    }

    // ─── Play intro once ────────────────────────────────────
    useEffect(() => {
        if (hasPlayedIntro.current || bottles.length === 0) return;
        hasPlayedIntro.current = true;

        // Phase 1: Shelf slides up from below
        Animated.timing(shelfSlideY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
        }).start(() => {
            // Phase 2: Bottles drop in with stagger
            const dropAnimations = bottleDropAnims.current.map((anim, i) =>
                Animated.sequence([
                    Animated.delay(i * 80),
                    Animated.parallel([
                        Animated.timing(anim, {
                            toValue: 0,
                            duration: 300,
                            easing: Easing.out(Easing.back(1.4)),
                            useNativeDriver: true,
                        }),
                        Animated.timing(bottleOpacityAnims.current[i], {
                            toValue: 1,
                            duration: 150,
                            useNativeDriver: true,
                        }),
                    ]),
                ])
            );

            Animated.parallel(dropAnimations).start();
        });
    }, [bottles.length]);

    // ─── Swap animation values ──────────────────────────────
    const scaleValues = useRef<Animated.Value[]>([]);
    if (scaleValues.current.length !== bottles.length) {
        scaleValues.current = bottles.map(
            (_, i) => scaleValues.current[i] ?? new Animated.Value(1)
        );
    }

    // ─── Swap animation ─────────────────────────────────────
    const animateSwap = useCallback(
        (indexA: number, indexB: number, onDone: () => void) => {
            const animA = scaleValues.current[indexA];
            const animB = scaleValues.current[indexB];

            setIsAnimating(true);

            // Phase 1: Shrink both bottles so they "vanish"
            Animated.parallel([
                Animated.timing(animA, {
                    toValue: 0,
                    duration: 150,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(animB, {
                    toValue: 0,
                    duration: 150,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
            ]).start(() => {
                pendingSwapRef.current = true;

                setDisplayBottles(prev => {
                    const next = [...prev];
                    [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
                    return next;
                });

                // Phase 2: Pop them back in
                Animated.parallel([
                    Animated.timing(animA, {
                        toValue: 1,
                        duration: 150,
                        easing: Easing.out(Easing.back(1.5)),
                        useNativeDriver: true,
                    }),
                    Animated.timing(animB, {
                        toValue: 1,
                        duration: 150,
                        easing: Easing.out(Easing.back(1.5)),
                        useNativeDriver: true,
                    }),
                ]).start(() => {
                    setIsAnimating(false);
                    onDone();
                });
            });
        },
        []
    );

    // ─── Tap logic ──────────────────────────────────────────
    const handleBottlePress = useCallback(
        (index: number) => {
            if (disabled || hasSwapped || isAnimating) return;

            if (selectedIndex === null) {
                setSelectedIndex(index);
            } else if (selectedIndex === index) {
                setSelectedIndex(null);
            } else {
                const from = selectedIndex;
                const to = index;
                setSelectedIndex(null);
                animateSwap(from, to, () => onSwap(from, to));
            }
        },
        [selectedIndex, disabled, hasSwapped, isAnimating, animateSwap, onSwap]
    );

    // Clear selection when turn changes
    useEffect(() => {
        setSelectedIndex(null);
    }, [disabled]);

    const shelfSurfaceY = FULL_SHELF_HEIGHT * SHELF_TOP_LEDGE_PERCENT;

    return (
        <Animated.View
            style={[
                styles.container,
                { width: SHELF_WIDTH, height: CONTAINER_HEIGHT, overflow: 'hidden' },
                { transform: [{ translateY: shelfSlideY }] },
            ]}
        >
            {/* Instead of squishing, we draw the image at its full height so the aspect ratio is perfect.
                Because the container is shorter and has overflow:hidden, the bottom gets sliced off. */}
            <Image
                source={SHELF_IMAGE}
                style={{ width: SHELF_WIDTH, height: FULL_SHELF_HEIGHT, resizeMode: 'stretch' }}
            />

            {/* Bottles sitting on top shelf ledge */}
            <View
                style={[
                    styles.bottleRow,
                    { top: shelfSurfaceY - 64 }, // reduced from 84 to push bottles down
                ]}
            >
                {displayBottles.map((color, index) => (
                    <Animated.View
                        key={index}
                        style={{
                            transform: [
                                { translateY: bottleDropAnims.current[index] ?? 0 },
                                { scale: scaleValues.current[index] },
                            ],
                            opacity: bottleOpacityAnims.current[index] ?? 1,
                            zIndex: selectedIndex === index ? 10 : 1,
                        }}
                    >
                        <Bottle
                            color={color}
                            index={index}
                            selected={selectedIndex === index}
                            disabled={disabled || hasSwapped || isAnimating}
                            onPress={handleBottlePress}
                        />
                    </Animated.View>
                ))}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        alignSelf: 'center',
    },
    bottleRow: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
    },
});
