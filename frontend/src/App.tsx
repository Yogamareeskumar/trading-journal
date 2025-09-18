import React, { useState, useEffect } from 'react';
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { createClient } from '@supabase/supabase-js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, 
  Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ComposedChart, ReferenceLine, Radar, LineChart, Line
} from 'recharts';
import { format } from 'date-fns';
import './App.css';

const supabaseUrl = 'https://fsicauceosmdrhxmvreu.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
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

function PremiumSignIn() {
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

      // Check if user exists in database
      let { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      let userData: User;

      if (!existingUser) {
        // Create new user record
        const newUser = {
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'Unknown User',
          avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
          provider: authUser.app_metadata?.provider || 'google',
          created_at: new Date().toISOString(),
          last_sign_in: new Date().toISOString(),
          subscription_tier: 'free',
          is_active: true
        };

        const { data: createdUser, error: insertError } = await supabase
          .from('users')
          .insert([newUser])
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        userData = createdUser;
      } else {
        // Update last sign in
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ 
            last_sign_in: new Date().toISOString(),
            is_active: true
          })
          .eq('id', authUser.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        userData = updatedUser;
      }

      setAuthState({
        user: userData,
        session,
        loading: false
      });

      setError(null);
    } catch (error) {
      console.error('Error handling auth success:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      setAuthState({ user: null, session: null, loading: false });
    }
  };

  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    setSignInLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setError(error instanceof Error ? error.message : 'Failed to sign in with Google');
      setSignInLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setAuthState({ user: null, session: null, loading: false });
    } catch (error) {
      console.error('Error signing out:', error);
      setError(error instanceof Error ? error.message : 'Failed to sign out');
    }
  };

  // Loading state
  if (authState.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-primary rounded-full mb-4"></div>
            <p className="text-muted-foreground">Initializing authentication...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authenticated state - show user dashboard
  if (authState.user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  TradingJournal Pro
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  {authState.user.avatar_url && (
                    <img 
                      src={authState.user.avatar_url} 
                      alt={authState.user.full_name}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div className="text-sm">
                    <div className="font-medium text-foreground">{authState.user.full_name}</div>
                    <div className="text-muted-foreground">{authState.user.email}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    authState.user.subscription_tier === 'premium' 
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black'
                      : authState.user.subscription_tier === 'enterprise'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {authState.user.subscription_tier?.toUpperCase() || 'FREE'}
                  </span>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Welcome back, {authState.user.full_name}!</CardTitle>
              <CardDescription>
                You're signed in and ready to track your trading performance.
                {authState.user.subscription_tier === 'free' && (
                  <span className="block mt-2 text-yellow-600 font-medium">
                    ⭐ Upgrade to Premium for advanced analytics and unlimited trades
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {new Date(authState.user.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Member Since</div>
                </div>
                
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {new Date(authState.user.last_sign_in).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Last Sign In</div>
                </div>
                
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {authState.user.provider.toUpperCase()}
                  </div>
                  <div className="text-sm text-muted-foreground">Auth Provider</div>
                </div>
              </div>
              
              {authState.user.subscription_tier === 'free' && (
                <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-yellow-800">Unlock Premium Features</h3>
                      <p className="text-sm text-yellow-700">
                        Advanced analytics, unlimited trades, AI insights, and more
                      </p>
                    </div>
                    <Button className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-medium">
                      Upgrade Now
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Your existing TradingJournal component would go here */}
          <div className="text-center text-muted-foreground">
            <p>Your trading journal interface will be integrated here.</p>
            <p className="text-sm mt-2">User ID: {authState.user.id}</p>
          </div>
        </div>
      </div>
    );
  }

  // Sign in state
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">TradingJournal Pro</h1>
          <p className="text-slate-300">Professional trading analytics platform</p>
        </div>

        {/* Sign in card */}
        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-bold text-slate-800">Welcome Back</CardTitle>
            <CardDescription className="text-slate-600">
              Sign in to access your trading dashboard and advanced analytics
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            <Button 
              onClick={handleGoogleSignIn}
              disabled={signInLoading}
              className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 font-medium transition-all duration-200 shadow-sm hover:shadow"
            >
              {signInLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full mr-3"></div>
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </div>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Secure authentication via Google</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center text-xs text-slate-600">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <span>Secure</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <span>Fast</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <span>Private</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-slate-400 text-sm">
          <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}

export default PremiumSignIn;

interface JournalEntry {
  s_no: number;
  gmail: string;
  status: 'open' | 'closed';
  broker: string;
  market: string;
  instrument: string;
  direction: 'buy' | 'sell';
  qty: number;
  entry_price: number;
  exit_price?: number;
  entry_dt: string;
  exit_dt?: string;
  stoploss: number;
  commission: number;
  p_and_l?: number;
  strategy: string;
  setup?: string;
  reason?: string;
}

interface Statistics {
  total_trades: number;
  open_trades: number;
  closed_trades: number;
  total_pnl: number;
  avg_pnl: number;
  winning_trades: number;
  losing_trades: number;
  best_trade: number;
  worst_trade: number;
  win_rate: number;
}

interface AdvancedStats {
  basic: {
    totalTrades: number;
    closedTrades: number;
    openTrades: number;
    totalPnL: number;
    avgPnL: number;
    winRate: number;
    profitFactor: number;
    expectancy: number;
  };
  risk: {
    sharpeRatio: number;
    maxDrawdown: number;
    calmarRatio: number;
    var95: number;
    var99: number;
    volatility: number;
  };
  performance: {
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    riskRewardRatio: number;
    kellyPercentage: number;
    annualReturn: number;
  };
  time: {
    firstTradeDate: string;
    lastTradeDate: string;
    tradingDays: number;
    avgTradesPerMonth: number;
  };
}

interface TimeSeriesData {
  period: string;
  trades: number;
  totalPnL: number;
  wins: number;
  losses: number;
  volume: number;
  cumulativePnL: number;
  winRate: number;
  avgPnL: number;
}

interface PatternData {
  bestWinStreak: number;
  worstLossStreak: number;
  dayOfWeekPerformance: Record<string, {
    trades: number;
    totalPnL: number;
    winRate: number;
  }>;
  instrumentPerformance: Record<string, {
    trades: number;
    totalPnL: number;
    winRate: number;
    avgPnL: number;
  }>;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function TradingJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trades' | 'analytics' | 'patterns'>('dashboard');
  
  // Advanced Analytics State
  const [advancedStats, setAdvancedStats] = useState<AdvancedStats | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [patternData, setPatternData] = useState<PatternData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // User state
  const userEmail = 'user@example.com';

  // Form state
  const [formData, setFormData] = useState({
    broker: '',
    market: '',
    instrument: '',
    direction: 'buy' as 'buy' | 'sell',
    qty: '',
    entry_price: '',
    exit_price: '',
    entry_dt: '',
    exit_dt: '',
    stoploss: '',
    commission: '',
    setup: '',
    reason: ''
  });

  // API helper function
  const apiCall = async <T,>(endpoint: string, options?: RequestInit): Promise<T> => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  };

  // Check API connection
  const checkApiConnection = async () => {
    try {
      await apiCall('/health');
      setApiConnected(true);
      return true;
    } catch (error) {
      console.error('API connection failed:', error);
      setApiConnected(false);
      return false;
    }
  };

  // Fetch entries from API
  const fetchEntries = async () => {
    try {
      const response = await apiCall<{trades: JournalEntry[]}>(`/trades?gmail=${encodeURIComponent(userEmail)}&limit=1000`);
      
      if (response.trades) {
        const formattedEntries = response.trades.map((entry: JournalEntry) => ({
          ...entry,
          entry_dt: new Date(entry.entry_dt).toISOString().slice(0, 16),
          exit_dt: entry.exit_dt ? new Date(entry.exit_dt).toISOString().slice(0, 16) : undefined,
        }));
        
        setEntries(formattedEntries);
        console.log(`Fetched ${formattedEntries.length} entries from API`);
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
      alert('Failed to fetch trading entries from server.');
    }
  };

  // Fetch statistics from API
  const fetchStatistics = async () => {
    try {
      const stats = await apiCall<Statistics>(`/analytics/stats?gmail=${encodeURIComponent(userEmail)}`);
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

  // Fetch advanced analytics
  const fetchAdvancedStats = async () => {
    try {
      const response = await apiCall<{stats: AdvancedStats}>(`/analytics/advanced-stats?gmail=${encodeURIComponent(userEmail)}`);
      if (response.stats) {
        setAdvancedStats(response.stats);
      }
    } catch (error) {
      console.error('Failed to fetch advanced stats:', error);
    }
  };

  const fetchTimeSeriesData = async () => {
    try {
      const response = await apiCall<{data: TimeSeriesData[]}>(`/analytics/time-series?gmail=${encodeURIComponent(userEmail)}&period=${selectedPeriod}`);
      if (response.data) {
        setTimeSeriesData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch time series data:', error);
    }
  };

  const fetchPatternData = async () => {
    try {
      const response = await apiCall<{patterns: PatternData}>(`/analytics/patterns?gmail=${encodeURIComponent(userEmail)}`);
      if (response.patterns) {
        setPatternData(response.patterns);
      }
    } catch (error) {
      console.error('Failed to fetch pattern data:', error);
    }
  };

  // Initialize API connection and load data
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      const connected = await checkApiConnection();
      if (connected) {
        await Promise.all([
          fetchEntries(),
          fetchStatistics(),
          fetchAdvancedStats(),
          fetchTimeSeriesData(),
          fetchPatternData(),
        ]);
      } else {
        alert('Unable to connect to the backend API. Please ensure the server is running on http://localhost:3001');
      }
      setLoading(false);
    };
    
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch time series data when period changes
  useEffect(() => {
    if (apiConnected) {
      fetchTimeSeriesData();
    }
  }, [selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save entry to API
  const saveEntry = async (entry: Omit<JournalEntry, 's_no'>) => {
    try {
      const response = await apiCall<{trade: JournalEntry}>('/trades', {
        method: 'POST',
        body: JSON.stringify(entry),
      });

      if (response.trade) {
        const formattedEntry = {
          ...response.trade,
          entry_dt: new Date(response.trade.entry_dt).toISOString().slice(0, 16),
          exit_dt: response.trade.exit_dt ? new Date(response.trade.exit_dt).toISOString().slice(0, 16) : undefined,
        };
        
        console.log('Entry saved successfully:', formattedEntry.s_no);
        return formattedEntry;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to save entry:', error);
      throw error;
    }
  };

  // Update entry via API
  const updateEntry = async (entry: JournalEntry) => {
    try {
      const response = await apiCall<{trade: JournalEntry}>(`/trades/${entry.s_no}`, {
        method: 'PUT',
        body: JSON.stringify(entry),
      });

      if (response.trade) {
        const formattedEntry = {
          ...response.trade,
          entry_dt: new Date(response.trade.entry_dt).toISOString().slice(0, 16),
          exit_dt: response.trade.exit_dt ? new Date(response.trade.exit_dt).toISOString().slice(0, 16) : undefined,
        };
        
        console.log('Entry updated successfully:', formattedEntry.s_no);
        return formattedEntry;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to update entry:', error);
      throw error;
    }
  };

  // Delete entry via API
  const deleteEntry = async (sNo: number) => {
    try {
      await apiCall(`/trades/${sNo}`, {
        method: 'DELETE',
      });
      console.log('Entry deleted successfully:', sNo);
    } catch (error) {
      console.error('Failed to delete entry:', error);
      throw error;
    }
  };

  // Calculate strategy based on duration
  const calculateStrategy = (entryDt: string, exitDt?: string): string => {
    if (!exitDt) return 'open_position';
    
    const entryTime = new Date(entryDt).getTime();
    const exitTime = new Date(exitDt).getTime();
    const durationHours = (exitTime - entryTime) / (1000 * 60 * 60);

    if (durationHours <= 1) return 'scalping';
    if (durationHours <= 24) return 'intraday';
    if (durationHours <= 168) return 'swing';
    if (durationHours <= 744) return 'positional';
    return 'long_term';
  };

  // Calculate P&L
  const calculatePnL = (qty: number, entryPrice: number, exitPrice?: number, commission: number = 0, direction: 'buy' | 'sell' = 'buy'): number | undefined => {
    if (!exitPrice) return undefined;
    
    let pnl: number;
    if (direction === 'buy') {
      pnl = (qty * (exitPrice - entryPrice)) - commission;
    } else {
      pnl = (qty * (entryPrice - exitPrice)) - commission;
    }
    
    return pnl;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiConnected) {
      alert('API connection not available. Please refresh the page or check server status.');
      return;
    }
    
    setLoading(true);
    
    try {
      const entryDateTime = formData.entry_dt || new Date().toISOString().slice(0, 16);
      const exitDateTime = formData.exit_dt || undefined;
      const exitPrice = formData.exit_price ? parseFloat(formData.exit_price) : undefined;
      const qty = parseFloat(formData.qty);
      const entryPrice = parseFloat(formData.entry_price);
      const commission = parseFloat(formData.commission);
      
      const strategy = calculateStrategy(entryDateTime, exitDateTime);
      const pnl = calculatePnL(qty, entryPrice, exitPrice, commission, formData.direction);
      const status: 'open' | 'closed' = exitPrice && exitDateTime ? 'closed' : 'open';

      const entryData = {
        gmail: userEmail,
        status,
        broker: formData.broker,
        market: formData.market,
        instrument: formData.instrument,
        direction: formData.direction,
        qty,
        entry_price: entryPrice,
        exit_price: exitPrice,
        entry_dt: entryDateTime,
        exit_dt: exitDateTime,
        stoploss: parseFloat(formData.stoploss),
        commission,
        p_and_l: pnl,
        strategy,
        setup: formData.setup,
        reason: formData.reason
      };

      if (editingEntry) {
        const updatedEntry = await updateEntry({ ...entryData, s_no: editingEntry.s_no });
        setEntries(entries.map(entry => entry.s_no === editingEntry.s_no ? updatedEntry : entry));
        alert('Trade updated successfully!');
      } else {
        const savedEntry = await saveEntry(entryData);
        setEntries([savedEntry, ...entries]);
        alert('Trade saved successfully!');
      }

      await Promise.all([
        fetchStatistics(),
        fetchAdvancedStats(),
        fetchTimeSeriesData(),
        fetchPatternData(),
      ]);
      resetForm();
    } catch (error) {
      console.error('Failed to save entry:', error);
      alert(`Failed to save entry. ${error instanceof Error ? error.message : 'Please check your input and try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      broker: '',
      market: '',
      instrument: '',
      direction: 'buy',
      qty: '',
      entry_price: '',
      exit_price: '',
      entry_dt: '',
      exit_dt: '',
      stoploss: '',
      commission: '',
      setup: '',
      reason: ''
    });
    setShowForm(false);
    setEditingEntry(null);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setFormData({
      broker: entry.broker,
      market: entry.market,
      instrument: entry.instrument,
      direction: entry.direction,
      qty: entry.qty.toString(),
      entry_price: entry.entry_price.toString(),
      exit_price: entry.exit_price?.toString() || '',
      entry_dt: entry.entry_dt,
      exit_dt: entry.exit_dt || '',
      stoploss: entry.stoploss.toString(),
      commission: entry.commission.toString(),
      setup: entry.setup || '',
      reason: entry.reason || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (sNo: number) => {
    if (window.confirm('Are you sure you want to delete this trade?')) {
      try {
        setLoading(true);
        await deleteEntry(sNo);
        setEntries(entries.filter(entry => entry.s_no !== sNo));
        await Promise.all([
          fetchStatistics(),
          fetchAdvancedStats(),
          fetchTimeSeriesData(),
          fetchPatternData(),
        ]);
        alert('Trade deleted successfully!');
      } catch (error) {
        console.error('Failed to delete entry:', error);
        alert(`Failed to delete entry. ${error instanceof Error ? error.message : 'Please try again.'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Filter entries
  const filteredEntries = entries.filter(entry => {
    if (filter !== 'all' && entry.status !== filter) return false;
    if (strategyFilter !== 'all' && entry.strategy !== strategyFilter) return false;
    return true;
  });

  // Get statistics with fallback to calculated values
  const stats = statistics || {
    total_trades: entries.length,
    open_trades: entries.filter(e => e.status === 'open').length,
    closed_trades: entries.filter(e => e.status === 'closed').length,
    total_pnl: entries.reduce((sum, entry) => sum + (entry.p_and_l || 0), 0),
    win_rate: entries.filter(e => e.status === 'closed').length > 0 
      ? (entries.filter(e => (e.p_and_l || 0) > 0).length / entries.filter(e => e.status === 'closed').length * 100)
      : 0
  };

  const strategies = Array.from(new Set(entries.map(e => e.strategy)));

  // Helper functions for charts
  const preparePerformanceRadarData = () => {
    if (!advancedStats) return [];
    
    return [
      {
        metric: 'Win Rate',
        value: Math.min(advancedStats.basic.winRate, 100),
        fullMark: 100
      },
      {
        metric: 'Profit Factor',
        value: Math.min(advancedStats.basic.profitFactor * 20, 100),
        fullMark: 100
      },
      {
        metric: 'Sharpe Ratio',
        value: Math.min(Math.max(advancedStats.risk.sharpeRatio * 25 + 50, 0), 100),
        fullMark: 100
      },
      {
        metric: 'Risk/Reward',
        value: Math.min(advancedStats.performance.riskRewardRatio * 25, 100),
        fullMark: 100
      },
      {
        metric: 'Consistency',
        value: Math.max(100 - advancedStats.risk.volatility, 0),
        fullMark: 100
      }
    ];
  };

  const prepareDayOfWeekData = () => {
    if (!patternData) return [];
    
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return dayOrder.map(day => ({
      day: day.slice(0, 3),
      ...patternData.dayOfWeekPerformance[day] || { trades: 0, totalPnL: 0, winRate: 0 }
    })).filter(d => d.trades > 0);
  };

  const prepareInstrumentData = () => {
    if (!patternData) return [];
    
    return Object.entries(patternData.instrumentPerformance)
      .map(([instrument, data]) => ({
        instrument,
        ...data
      }))
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, 10);
  };

  // Advanced Analytics Functions
  const generateAnalytics = async () => {
    if (entries.length === 0) {
      alert('No trading data available for analysis.');
      return;
    }

    setLoading(true);
    try {
      const analyticsData = {
        totalTrades: entries.length,
        closedTrades: entries.filter(e => e.status === 'closed').length,
        totalPnL: entries.reduce((sum, e) => sum + (e.p_and_l || 0), 0),
        winRate: entries.filter(e => e.status === 'closed').length > 0 
          ? (entries.filter(e => (e.p_and_l || 0) > 0).length / entries.filter(e => e.status === 'closed').length * 100)
          : 0,
        strategies: Array.from(new Set(entries.map(e => e.strategy))),
        avgPnL: entries.length > 0 ? (entries.reduce((sum, e) => sum + (e.p_and_l || 0), 0) / entries.length) : 0,
        bestPerformingStrategy: (() => {
          const strategyPerf = Array.from(new Set(entries.map(e => e.strategy))).map(strategy => {
            const trades = entries.filter(e => e.strategy === strategy);
            const pnl = trades.reduce((sum, t) => sum + (t.p_and_l || 0), 0);
            return { strategy, pnl, trades: trades.length };
          });
          return strategyPerf.sort((a, b) => b.pnl - a.pnl)[0];
        })()
      };

      const response = await fetch('https://oi-server.onrender.com/chat/completions', {
        method: 'POST',
        headers: {
          'customerId': 'cus_T16LkQBOoDWzQN',
          'Content-Type': 'application/json',
          'Authorization': 'Bearer xxx'
        },
        body: JSON.stringify({
          model: 'openrouter/claude-sonnet-4',
          messages: [
            {
              role: 'system',
              content: `You are a professional trader. Analyze the provided trading data and provide comprehensive insights in JSON format. 

              Provide analysis in this exact JSON structure:
              {
                "performance_metrics": {
                  "sharpe_ratio": "calculated or estimated value",
                  "max_drawdown": "percentage",
                  "profit_factor": "ratio",
                  "return_on_investment": "percentage"
                },
                "risk_analysis": {
                  "avg_risk": "average risk per trade",
                  "risk_reward_ratio": "calculated ratio",
                  "consistency": "score out of 100",
                  "volatility": "assessment"
                },
                "strategy_analysis": {
                  "best_strategy": "strategy name",
                  "worst_strategy": "strategy name",
                  "strategy_recommendations": ["recommendation1", "recommendation2"]
                },
                "recommendations": [
                  "specific actionable recommendation 1",
                  "specific actionable recommendation 2",
                  "specific actionable recommendation 3",
                  "specific actionable recommendation 4",
                  "specific actionable recommendation 5"
                ],
                "market_insights": {
                  "trending_instruments": ["instrument1", "instrument2"],
                  "market_conditions": "assessment",
                  "timing_analysis": "insights on trade timing"
                }
              }

              Return only valid JSON without any markdown formatting or explanations.`
            },
            {
              role: 'user',
              content: `Analyze this trading portfolio data:

              Summary Statistics:
              - Total Trades: ${analyticsData.totalTrades}
              - Closed Trades: ${analyticsData.closedTrades}
              - Total P&L: ₹${analyticsData.totalPnL.toFixed(2)}
              - Win Rate: ${analyticsData.winRate.toFixed(1)}%
              - Average P&L per Trade: ₹${analyticsData.avgPnL.toFixed(2)}
              - Strategies Used: ${analyticsData.strategies.join(', ')}
              - Best Performing Strategy: ${analyticsData.bestPerformingStrategy?.strategy} (₹${analyticsData.bestPerformingStrategy?.pnl.toFixed(2)} from ${analyticsData.bestPerformingStrategy?.trades} trades)

              Detailed Trade Data (last 50 trades):
              ${JSON.stringify(entries.slice(-50), null, 2)}`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid API response format');
      }

      try {
        const analyticsResult = JSON.parse(data.choices[0].message.content);
        setAnalytics(analyticsResult);
      } catch (parseError) {
        console.error('Failed to parse analytics JSON from AI response:', parseError);
        setAnalytics({
          performance_metrics: {
            sharpe_ratio: "Data insufficient",
            max_drawdown: "Calculating...",
            profit_factor: analyticsData.totalPnL > 0 ? "Positive" : "Negative",
            return_on_investment: `${((analyticsData.totalPnL / Math.max(analyticsData.totalTrades * 1000, 1)) * 100).toFixed(2)}%`
          },
          risk_analysis: {
            avg_risk: `₹${(Math.abs(analyticsData.totalPnL) / Math.max(analyticsData.totalTrades, 1)).toFixed(2)}`,
            risk_reward_ratio: "1:1.5",
            consistency: Math.min(analyticsData.winRate + 10, 100).toString(),
            volatility: analyticsData.totalTrades < 10 ? "High (Low sample size)" : "Moderate"
          },
          recommendations: [
            `Your current win rate is ${analyticsData.winRate.toFixed(1)}%. ${analyticsData.winRate > 50 ? 'Good performance! Focus on increasing position sizes for winning trades.' : 'Consider reviewing your entry criteria and risk management.'}`,
            `You have ${analyticsData.totalTrades} trades. ${analyticsData.totalTrades < 20 ? 'Increase sample size for better statistics.' : 'Good sample size for analysis.'}`,
            `Your best strategy is ${analyticsData.bestPerformingStrategy?.strategy}. Consider focusing more on this approach.`,
            "Maintain consistent position sizing and risk management.",
            "Keep detailed notes on trade setups for pattern recognition."
          ]
        });
      }
    } catch (error) {
      console.error('Analytics generation failed:', error);
      alert(`Failed to generate AI insights. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Chart data preparation
  const prepareChartData = () => {
    const sortedEntries = [...entries].sort((a, b) => new Date(a.entry_dt).getTime() - new Date(b.entry_dt).getTime());
    
    let cumulativePnL = 0;
    const cumulativePnLData = sortedEntries.map((entry, index) => {
      if (entry.p_and_l) cumulativePnL += entry.p_and_l;
      return {
        trade: index + 1,
        pnl: entry.p_and_l || 0,
        cumulativePnL: cumulativePnL,
        date: new Date(entry.entry_dt).toLocaleDateString(),
        strategy: entry.strategy,
        instrument: entry.instrument
      };
    });

    const strategyPerformance = strategies.map(strategy => {
      const strategyTrades = entries.filter(e => e.strategy === strategy);
      const totalPnL = strategyTrades.reduce((sum, trade) => sum + (trade.p_and_l || 0), 0);
      const winRate = strategyTrades.length > 0 
        ? (strategyTrades.filter(t => (t.p_and_l || 0) > 0).length / strategyTrades.length * 100)
        : 0;
      
      return {
        strategy,
        totalPnL,
        winRate: parseFloat(winRate.toFixed(1)),
        trades: strategyTrades.length,
        avgPnL: strategyTrades.length > 0 ? totalPnL / strategyTrades.length : 0
      };
    });

    const monthlyData = entries.reduce((acc: { [key: string]: { month: string; trades: number; pnl: number; wins: number; } }, entry) => {
      const month = new Date(entry.entry_dt).toISOString().slice(0, 7);
      if (!acc[month]) {
        acc[month] = { month, trades: 0, pnl: 0, wins: 0 };
      }
      acc[month].trades += 1;
      acc[month].pnl += entry.p_and_l || 0;
      if ((entry.p_and_l || 0) > 0) acc[month].wins += 1;
      return acc;
    }, {});

    const monthlyPerformance = Object.values(monthlyData).map((data: { month: string; trades: number; pnl: number; wins: number; }) => ({
      ...data,
      winRate: data.trades > 0 ? (data.wins / data.trades * 100) : 0
    }));

    const riskDistribution = entries
      .filter(e => e.p_and_l !== undefined && e.stoploss !== undefined)
      .map(e => {
        const risk = Math.abs(e.entry_price - e.stoploss) * e.qty;
        const reward = e.p_and_l || 0;
        return {
          risk,
          reward,
          rMultiple: risk > 0 ? reward / risk : 0,
          instrument: e.instrument,
          strategy: e.strategy
        };
      });

    return {
      cumulativePnLData,
      strategyPerformance,
      monthlyPerformance,
      riskDistribution
    };
  };

  const chartData = prepareChartData();
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff'];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Advanced Trading Journal</h1>
          <p className="text-gray-600">Professional trading analytics with data science insights</p>
          
          <div className={`mt-2 px-3 py-1 rounded-full text-xs font-medium inline-block ${
            apiConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            Backend API: {apiConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200">
          {[
            { key: 'dashboard', label: '📊 Dashboard' },
            { key: 'analytics', label: '📈 Analytics' },
            { key: 'patterns', label: '🔍 Patterns' },
            { key: 'trades', label: '💼 Trades' }
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.key as any)}
              className="mb-2"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">{stats.total_trades}</div>
                  <div className="text-sm text-gray-600">Total Trades</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600">{stats.open_trades}</div>
                  <div className="text-sm text-gray-600">Open Trades</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-purple-600">{stats.closed_trades}</div>
                  <div className="text-sm text-gray-600">Closed Trades</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className={`text-2xl font-bold ${stats.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{stats.total_pnl.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">Total P&L</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">{stats.win_rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Win Rate</div>
                </CardContent>
              </Card>
            </div>

            {advancedStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Sharpe Ratio</p>
                        <p className={`text-3xl font-bold ${
                          advancedStats.risk.sharpeRatio > 1 ? 'text-green-600' : 
                          advancedStats.risk.sharpeRatio > 0 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {advancedStats.risk.sharpeRatio.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-2xl">📊</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Risk-adjusted returns</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Max Drawdown</p>
                        <p className="text-3xl font-bold text-red-600">
                          {advancedStats.risk.maxDrawdown.toFixed(2)}%
                        </p>
                      </div>
                      <div className="text-2xl">⚠️</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Worst decline from peak</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Risk/Reward</p>
                        <p className="text-3xl font-bold text-blue-600">
                          {advancedStats.performance.riskRewardRatio.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-2xl">⚖️</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Average risk vs reward</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Kelly %</p>
                        <p className="text-3xl font-bold text-purple-600">
                          {advancedStats.performance.kellyPercentage.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-2xl">🎯</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Optimal position size</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cumulative P&L Over Time</CardTitle>
                  <CardDescription>Track your trading performance progression</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="period" 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                          formatter={(value: any) => [`₹${parseFloat(value.toString()).toFixed(2)}`, 'Cumulative P&L']}
                          labelFormatter={(value) => format(new Date(value), 'PPP')}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="cumulativePnL" 
                          stroke="#8884d8" 
                          fill="#8884d8" 
                          fillOpacity={0.3} 
                        />
                        <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Radar</CardTitle>
                  <CardDescription>Multi-dimensional performance analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={preparePerformanceRadarData()}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis 
                          angle={90} 
                          domain={[0, 100]} 
                          tick={{ fontSize: 8 }}
                        />
                        <Radar
                          name="Performance"
                          dataKey="value"
                          stroke="#8884d8"
                          fill="#8884d8"
                          fillOpacity={0.3}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Label>Time Period:</Label>
              <Select value={selectedPeriod} onValueChange={(value: string) => setSelectedPeriod(value as any)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>P&L Distribution</CardTitle>
                  <CardDescription>Win/Loss distribution over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="period"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                        />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Bar yAxisId="left" dataKey="totalPnL" fill="#8884d8" />
                        <Line yAxisId="right" type="monotone" dataKey="winRate" stroke="#ff7300" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trading Volume Analysis</CardTitle>
                  <CardDescription>Volume vs Performance correlation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart data={timeSeriesData}>
                        <CartesianGrid />
                        <XAxis 
                          dataKey="volume" 
                          name="Volume"
                          tickFormatter={(value) => `₹${(value/1000).toFixed(0)}K`}
                        />
                        <YAxis dataKey="totalPnL" name="P&L" />
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }}
                          formatter={(value: any, name: string) => [
                            name === 'volume' ? `₹${parseFloat(value.toString()).toFixed(0)}` : `₹${parseFloat(value.toString()).toFixed(2)}`,
                            name === 'volume' ? 'Volume' : 'P&L'
                          ]}
                        />
                        <Scatter name="Trades" dataKey="totalPnL" fill="#8884d8" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Patterns Tab */}
        {activeTab === 'patterns' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Day of Week Performance</CardTitle>
                  <CardDescription>Which days are most profitable?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={prepareDayOfWeekData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Bar yAxisId="left" dataKey="totalPnL" fill="#8884d8" name="Total P&L" />
                        <Line yAxisId="right" type="monotone" dataKey="winRate" stroke="#ff7300" name="Win Rate %" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Instruments Performance</CardTitle>
                  <CardDescription>Best performing trading instruments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={prepareInstrumentData()} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="instrument" type="category" width={80} />
                        <Tooltip />
                        <Bar dataKey="totalPnL" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {patternData && (
              <Card>
                <CardHeader>
                  <CardTitle>Trading Patterns & Insights</CardTitle>
                  <CardDescription>AI-detected patterns in your trading behavior</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">{patternData.bestWinStreak}</div>
                      <div className="text-sm text-gray-600">Best Win Streak</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-3xl font-bold text-red-600">{patternData.worstLossStreak}</div>
                      <div className="text-sm text-gray-600">Worst Loss Streak</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600">
                        {Object.keys(patternData.instrumentPerformance).length}
                      </div>
                      <div className="text-sm text-gray-600">Instruments Traded</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-3xl font-bold text-purple-600">
                        {Object.keys(patternData.dayOfWeekPerformance).length}
                      </div>
                      <div className="text-sm text-gray-600">Active Trading Days</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Trades Tab */}
        {activeTab === 'trades' && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <Button 
                onClick={() => setShowForm(!showForm)}
                variant={showForm ? "secondary" : "default"}
                disabled={!apiConnected}
              >
                {showForm ? 'Cancel' : 'Add New Trade'}
              </Button>
              
              <Button 
                onClick={() => setShowAnalytics(!showAnalytics)}
                variant={showAnalytics ? "secondary" : "outline"}
              >
                {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
              </Button>
              
              <Button 
                onClick={generateAnalytics}
                variant="outline"
                disabled={entries.length === 0 || loading}
              >
                {loading ? 'Generating...' : 'Generate AI Insights'}
              </Button>
              
              <Select value={filter} onValueChange={(value: string) => setFilter(value as 'all' | 'open' | 'closed')}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={strategyFilter} onValueChange={setStrategyFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by Strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strategies</SelectItem>
                  {strategies.map(strategy => (
                    <SelectItem key={strategy} value={strategy}>{strategy}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showAnalytics && (
              <div className="mb-8 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Analytics</CardTitle>
                    <CardDescription>Comprehensive analysis of your trading performance</CardDescription>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cumulative P&L Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.cumulativePnLData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="trade" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: any, name: string) => [
                              name === 'cumulativePnL' ? `₹${value.toFixed(2)}` : `₹${value.toFixed(2)}`,
                              name === 'cumulativePnL' ? 'Cumulative P&L' : 'Trade P&L'
                            ]}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="cumulativePnL" 
                            stroke="#8884d8" 
                            fill="#8884d8" 
                            fillOpacity={0.3} 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Strategy Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.strategyPerformance}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="strategy" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <Tooltip 
                              formatter={(value: any, name: string) => [
                                name === 'totalPnL' ? `₹${value.toFixed(2)}` : `${value.toFixed(1)}%`,
                                name === 'totalPnL' ? 'Total P&L' : 'Win Rate'
                              ]}
                            />
                            <Bar dataKey="totalPnL" fill="#82ca9d" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Strategy Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData.strategyPerformance}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={120}
                              paddingAngle={5}
                              dataKey="trades"
                            >
                              {chartData.strategyPerformance.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: any) => [`${value} trades`, 'Count']}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {analytics && (
                  <Card>
                    <CardHeader>
                      <CardTitle>AI-Generated Insights</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {analytics.performance_metrics && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <h4 className="font-semibold mb-2">Performance Metrics</h4>
                              <div className="space-y-1 text-sm">
                                <p>Sharpe Ratio: {analytics.performance_metrics.sharpe_ratio}</p>
                                <p>Max Drawdown: {analytics.performance_metrics.max_drawdown}</p>
                                <p>Profit Factor: {analytics.performance_metrics.profit_factor}</p>
                              </div>
                            </div>
                          )}
                          
                          {analytics.risk_analysis && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <h4 className="font-semibold mb-2">Risk Analysis</h4>
                              <div className="space-y-1 text-sm">
                                <p>Avg Risk per Trade: {analytics.risk_analysis.avg_risk}</p>
                                <p>Risk-Reward Ratio: {analytics.risk_analysis.risk_reward_ratio}</p>
                                <p>Consistency Score: {analytics.risk_analysis.consistency}</p>
                              </div>
                            </div>
                          )}
                          
                          {analytics.recommendations && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <h4 className="font-semibold mb-2">Recommendations</h4>
                              <div className="space-y-1 text-sm">
                                {analytics.recommendations.slice(0, 3).map((rec: string, index: number) => (
                                  <p key={index}>• {rec}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {showForm && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>{editingEntry ? 'Edit Trade' : 'Add New Trade'}</CardTitle>
                  <CardDescription>Enter trade details to track your performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                      <Label className="text-sm font-medium">Account</Label>
                      <p className="text-sm text-gray-600">{userEmail}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="broker">Broker</Label>
                        <Input
                          id="broker"
                          value={formData.broker}
                          onChange={(e) => setFormData({...formData, broker: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="market">Market</Label>
                        <Input
                          id="market"
                          value={formData.market}
                          onChange={(e) => setFormData({...formData, market: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="instrument">Instrument</Label>
                        <Input
                          id="instrument"
                          value={formData.instrument}
                          onChange={(e) => setFormData({...formData, instrument: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="direction">Direction</Label>
                        <Select value={formData.direction} onValueChange={(value: string) => setFormData({...formData, direction: value as 'buy' | 'sell'})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="buy">Buy</SelectItem>
                            <SelectItem value="sell">Sell</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="qty">Quantity</Label>
                        <Input
                          id="qty"
                          type="number"
                          step="0.01"
                          value={formData.qty}
                          onChange={(e) => setFormData({...formData, qty: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="entry_price">Entry Price</Label>
                        <Input
                          id="entry_price"
                          type="number"
                          step="0.01"
                          value={formData.entry_price}
                          onChange={(e) => setFormData({...formData, entry_price: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="exit_price">Exit Price (Optional)</Label>
                        <Input
                          id="exit_price"
                          type="number"
                          step="0.01"
                          value={formData.exit_price}
                          onChange={(e) => setFormData({...formData, exit_price: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="stoploss">Stop Loss</Label>
                        <Input
                          id="stoploss"
                          type="number"
                          step="0.01"
                          value={formData.stoploss}
                          onChange={(e) => setFormData({...formData, stoploss: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="commission">Commission</Label>
                        <Input
                          id="commission"
                          type="number"
                          step="0.01"
                          value={formData.commission}
                          onChange={(e) => setFormData({...formData, commission: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="entry_dt">Entry Date/Time</Label>
                        <Input
                          id="entry_dt"
                          type="datetime-local"
                          value={formData.entry_dt}
                          onChange={(e) => setFormData({...formData, entry_dt: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="exit_dt">Exit Date/Time (Optional)</Label>
                        <Input
                          id="exit_dt"
                          type="datetime-local"
                          value={formData.exit_dt}
                          onChange={(e) => setFormData({...formData, exit_dt: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="setup">Setup</Label>
                        <Textarea
                          id="setup"
                          value={formData.setup}
                          onChange={(e) => setFormData({...formData, setup: e.target.value})}
                          placeholder="Describe your trading setup..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="reason">Reason</Label>
                        <Textarea
                          id="reason"
                          value={formData.reason}
                          onChange={(e) => setFormData({...formData, reason: e.target.value})}
                          placeholder="Why did you take this trade..."
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading || !apiConnected}>
                        {loading ? 'Saving...' : (editingEntry ? 'Update Trade' : 'Add Trade')}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Trade History ({filteredEntries.length} trades)</CardTitle>
                <CardDescription>Complete record of all your trades with advanced analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-2 font-semibold text-gray-900">ID</th>
                        <th className="text-left p-2 font-semibold text-gray-900">Status</th>
                        <th className="text-left p-2 font-semibold text-gray-900">Instrument</th>
                        <th className="text-left p-2 font-semibold text-gray-900">Direction</th>
                        <th className="text-left p-2 font-semibold text-gray-900">Qty</th>
                        <th className="text-left p-2 font-semibold text-gray-900">Entry</th>
                        <th className="text-left p-2 font-semibold text-gray-900">Exit</th>
                        <th className="text-left p-2 font-semibold text-gray-900">P&L</th>
                        <th className="text-left p-2 font-semibold text-gray-900">Strategy</th>
                        <th className="text-left p-2 font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => (
                        <tr key={entry.s_no} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2 text-gray-900">{entry.s_no}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              entry.status === 'open' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {entry.status}
                            </span>
                          </td>
                          <td className="p-2 text-gray-900">{entry.instrument}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              entry.direction === 'buy' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {entry.direction.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-2 text-gray-900">{entry.qty}</td>
                          <td className="p-2 text-gray-900">₹{entry.entry_price}</td>
                          <td className="p-2 text-gray-900">{entry.exit_price ? `₹${entry.exit_price}` : '-'}</td>
                          <td className={`p-2 font-semibold ${
                            (entry.p_and_l || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {entry.p_and_l ? `₹${entry.p_and_l.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {entry.strategy}
                            </span>
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleEdit(entry)}
                                className="text-xs"
                                disabled={!apiConnected}
                              >
                                Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                onClick={() => handleDelete(entry.s_no)}
                                className="text-xs"
                                disabled={!apiConnected}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredEntries.length === 0 && !loading && (
                    <div className="text-center py-8 text-gray-600">
                      {apiConnected 
                        ? "No trades found matching your filters."
                        : "Backend API connection required to view trades."
                      }
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {loading && (
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-blue-600 rounded-full mb-2"></div>
              <p className="text-gray-600">
                {entries.length === 0 ? 'Loading trades from server...' : 'Processing advanced analytics...'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}


export default TradingJournal;