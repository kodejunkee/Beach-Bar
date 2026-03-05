import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { supabase } from '@/lib/supabase';

const MAIN_BG = require('@/assets/images/backgrounds/main screen background.png');

export default function AuthScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);

    // Supabase requires an email, so we auto-generate one from the username
    const fakeEmail = (name: string) => `${name.trim().toLowerCase().replace(/\s+/g, '_')}@swapfrenzy.local`;

    const handleAuth = async () => {
        if (!username || !password) {
            Alert.alert('Error', 'Please fill in all fields.');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        try {
            const email = fakeEmail(username);

            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    if (error.message.includes('Invalid login credentials')) {
                        throw new Error('Invalid username or password.');
                    }
                    throw error;
                }
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { username: username.trim() }
                    }
                });
                if (error) {
                    if (error.message.includes('already registered')) {
                        throw new Error('This username is already taken.');
                    }
                    throw error;
                }
                // Auto-login right after signup (no email verification)
                const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
                if (loginError) throw loginError;
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInAnonymously();
            if (error) throw error;
        } catch (error: any) {
            Alert.alert('Guest Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ImageBackground source={MAIN_BG} style={styles.bg} resizeMode="cover">
            <View style={styles.bgOverlay}>
                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.card}>
                        <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor="#A08C75"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            maxLength={15}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#A08C75"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <TouchableOpacity
                            style={[styles.btn, loading && styles.btnDisabled]}
                            onPress={handleAuth}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#4A3423" />
                            ) : (
                                <Text style={styles.btnText}>{isLogin ? 'LOG IN' : 'SIGN UP'}</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.switchContainer}>
                            <Text style={styles.switchText}>
                                {isLogin ? "Don't have an account? " : "Already have an account? "}
                            </Text>
                            <TouchableOpacity onPress={() => setIsLogin(!isLogin)} disabled={loading}>
                                <Text style={styles.switchAction}>{isLogin ? 'Sign Up' : 'Log In'}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider}>
                            <View style={styles.line} />
                            <Text style={styles.orText}>OR</Text>
                            <View style={styles.line} />
                        </View>

                        <TouchableOpacity
                            style={styles.guestBtn}
                            onPress={handleGuestLogin}
                            disabled={loading}
                        >
                            <Text style={styles.guestBtnText}>Play as Guest</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    bg: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    bgOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 15, 26, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '100%',
        alignItems: 'center',
    },
    card: {
        backgroundColor: '#F4E9D8',
        padding: 30,
        borderRadius: 20,
        width: '85%',
        maxWidth: 400,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        borderWidth: 2,
        borderColor: '#8C6C42',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#4A3423',
        textAlign: 'center',
        marginBottom: 20,
        textShadowColor: 'rgba(255,255,255,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
    },
    input: {
        backgroundColor: '#E8DCC4',
        borderWidth: 1,
        borderColor: '#C4A47C',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
        color: '#4A3423',
        fontWeight: '600',
    },
    btn: {
        backgroundColor: '#F1C40F',
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 2,
        borderColor: '#D4AC0D',
        elevation: 3,
    },
    btnDisabled: {
        opacity: 0.7,
    },
    btnText: {
        color: '#4A3423',
        fontSize: 18,
        fontWeight: '800',
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    switchText: {
        color: '#705A42',
        fontSize: 14,
        fontWeight: '600',
    },
    switchAction: {
        color: '#2980B9',
        fontSize: 14,
        fontWeight: '800',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#C4A47C',
    },
    orText: {
        marginHorizontal: 10,
        color: '#8C6C42',
        fontWeight: '800',
    },
    guestBtn: {
        backgroundColor: '#E8DCC4',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#8C6C42',
    },
    guestBtnText: {
        color: '#4A3423',
        fontSize: 16,
        fontWeight: '700',
    },
});
