import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

export type UserProfile = {
    id: string;
    username: string;
    level: number;
    exp: number;
    gold: number;
    diamonds: number;
    equipped_frame: string | null;
    last_seen: string | null;
    created_at: string;
    rp: number;
    current_rank: string;
    peak_rank: string;
    highest_rp: number;
    ranked_wins: number;
    ranked_losses: number;
};

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    playerProfile: UserProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (data) {
                setProfile(data as UserProfile);
            } else if (error) {
                console.error('Error fetching profile:', error);
            }
        } catch (e) {
            console.error('Exception fetching profile:', e);
        }
    };

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            if (mounted) {
                setSession(initialSession);
                if (initialSession?.user) {
                    await fetchProfile(initialSession.user.id);
                }
                setLoading(false);
            }
        };

        initializeAuth();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (mounted) {
                    setSession(session);
                    if (session?.user) {
                        await fetchProfile(session.user.id);
                    } else {
                        setProfile(null);
                    }
                    setLoading(false);
                }
            }
        );

        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
        router.replace('/auth');
    };

    const refreshProfile = async () => {
        if (session?.user) {
            await fetchProfile(session.user.id);
        }
    };

    return (
        <AuthContext.Provider value={{
            session,
            user: session?.user || null,
            profile,
            playerProfile: profile,
            loading,
            signOut,
            refreshProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
}
