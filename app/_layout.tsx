import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { GameProvider } from '@/context/GameContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

function RootNavigation() {
    const { session, loading } = useAuth();
    const segments = useSegments();

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === 'auth';

        if (!session && !inAuthGroup) {
            // Redirect to the login page.
            router.replace('/auth');
        } else if (session && inAuthGroup) {
            // Redirect away from the login page.
            router.replace('/');
        }
    }, [session, loading, segments]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F1A' }}>
                <ActivityIndicator size="large" color="#FFD700" />
            </View>
        );
    }

    return (
        <GameProvider>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#0F0F1A' },
                    animation: 'fade',
                }}
            />
        </GameProvider>
    );
}

export default function RootLayout() {
    useEffect(() => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }, []);

    return (
        <AuthProvider>
            <RootNavigation />
        </AuthProvider>
    );
}
