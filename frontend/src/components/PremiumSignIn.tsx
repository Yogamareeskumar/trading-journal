import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fsicauceosmdrhxmvreu.supabase.co'
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  provider: string;
  created_at: string;
  last_sign_in: string;
  subscription_tier?: 'free' | 'premium' | 'enterprise';
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  session: any;
  loading: boolean;
}

interface PremiumSignInProps {
  onAuthSuccess: (user: User) => void;
}

export default function PremiumSignIn({ onAuthSuccess }: PremiumSignInProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true
  });
  const [signInLoading, setSignInLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Supabase auth listener
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleAuthSuccess(session);
      } else {
        setAuthState({ user: null, session: null, loading: false });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await handleAuthSuccess(session);
      } else if (event === 'SIGNED_OUT') {
        setAuthState({ user: null, session: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle successful authentication
  const handleAuthSuccess = async (session: any) => {
    try {
      const { user: authUser } = session;
      
      if (!authUser) {
        throw new Error('No user data received from authentication');
      }

      // Create user object
      const user: User = {
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name || authUser.email || '',
        avatar_url: authUser.user_metadata?.avatar_url,
        provider: authUser.app_metadata?.provider || 'email',
        created_at: authUser.created_at,
        last_sign_in: authUser.last_sign_in_at || new Date().toISOString(),
        subscription_tier: 'free', // Default to free tier
        is_active: true
      };

      setAuthState({ user, session, loading: false });
      onAuthSuccess(user);
      setError(null);
    } catch (err) {
      console.error('Auth success handler error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setAuthState({ user: null, session: null, loading: false });
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      setSignInLoading(true);
      setError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Google sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
    } finally {
      setSignInLoading(false);
    }
  };

  // Handle GitHub Sign In
  const handleGitHubSignIn = async () => {
    try {
      setSignInLoading(true);
      setError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('GitHub sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in with GitHub');
    } finally {
      setSignInLoading(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      setSignInLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Sign out error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    } finally {
      setSignInLoading(false);
    }
  };

  if (authState.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (authState.user) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Welcome Back!</CardTitle>
          <CardDescription>You are successfully signed in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            {authState.user.avatar_url && (
              <img 
                src={authState.user.avatar_url} 
                alt="Profile" 
                className="w-16 h-16 rounded-full mx-auto"
              />
            )}
            <h3 className="font-semibold">{authState.user.full_name}</h3>
            <p className="text-sm text-muted-foreground">{authState.user.email}</p>
            <p className="text-xs text-muted-foreground">
              Tier: {authState.user.subscription_tier || 'Free'}
            </p>
          </div>
          <Button 
            onClick={handleSignOut}
            disabled={signInLoading}
            className="w-full"
            variant="outline"
          >
            {signInLoading ? 'Signing Out...' : 'Sign Out'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Premium Sign In</CardTitle>
        <CardDescription>
          Sign in to access your premium trading journal features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}
        
        <Button
          onClick={handleGoogleSignIn}
          disabled={signInLoading}
          className="w-full"
          variant="outline"
        >
          {signInLoading ? 'Signing In...' : 'Continue with Google'}
        </Button>

        <Button
          onClick={handleGitHubSignIn}
          disabled={signInLoading}
          className="w-full"
          variant="outline"
        >
          {signInLoading ? 'Signing In...' : 'Continue with GitHub'}
        </Button>

        <div className="text-xs text-center text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </div>
      </CardContent>
    </Card>
  );
}