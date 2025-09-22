import React, { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Radar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  Shield,
  AlertTriangle,
  Award,
  Calendar,
  Clock,
  DollarSign,
  Activity,
  Users,
  LogOut,
  Plus,
  Edit,
  Trash2,
  Filter,
  RefreshCw,
  Brain,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  LineChart as LineChartIcon,
  RadarIcon,
  Sparkles,
  Crown,
  Star,
  Lock,
  Unlock,
  Globe,
} from "lucide-react";
import { createClient, AuthChangeEvent, Session } from "@supabase/supabase-js";

// Supabase client setup
const supabaseUrl = "https://fsicauceosmdrhxmvreu.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzaWNhdWNlb3NtZHJoeG12cmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMDI5OTksImV4cCI6MjA3MzY3ODk5OX0.J_Dx9SLkzffTFcDhxMix56cmtpM4710nqafnyP5BLhk";

if (!supabaseKey) {
  console.error(
    "Supabase key is missing. Please add REACT_APP_SUPABASE_ANON_KEY to your environment variables."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey!);

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  provider: string;
  created_at: string;
  last_sign_in: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  session: any;
  loading: boolean;
}

interface JournalEntry {
  s_no: number;
  status: "open" | "closed";
  broker: string;
  market: string;
  instrument: string;
  direction: "buy" | "sell";
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
  dayOfWeekPerformance: Record<
    string,
    {
      trades: number;
      totalPnL: number;
      winRate: number;
    }
  >;
  instrumentPerformance: Record<
    string,
    {
      trades: number;
      totalPnL: number;
      winRate: number;
      avgPnL: number;
    }
  >;
}

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001/api";

function TradingJournalApp() {
  // Auth state
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });
  const [signInLoading, setSignInLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trading journal state
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [analytics, setAnalytics] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "trades" | "analytics" | "patterns" | "insights"
  >("dashboard");

  // Advanced Analytics State
  const [advancedStats, setAdvancedStats] = useState<AdvancedStats | null>(
    null
  );
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [patternData, setPatternData] = useState<PatternData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");

  // Form state
  const [formData, setFormData] = useState({
    broker: "",
    market: "",
    instrument: "",
    direction: "buy" as "buy" | "sell",
    qty: "",
    entry_price: "",
    exit_price: "",
    entry_dt: "",
    exit_dt: "",
    stoploss: "",
    commission: "",
    strategy: "",
    setup: "",
    reason: "",
  });

  // Helper function to convert Supabase user to our User interface
  const convertSupabaseUser = (supabaseUser: any): User => {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || "",
      full_name:
        supabaseUser.user_metadata?.full_name ||
        supabaseUser.user_metadata?.name ||
        supabaseUser.email ||
        "User",
      avatar_url:
        supabaseUser.user_metadata?.avatar_url ||
        supabaseUser.user_metadata?.picture,
      provider: supabaseUser.app_metadata?.provider || "email",
      created_at: supabaseUser.created_at,
      last_sign_in: supabaseUser.last_sign_in_at || new Date().toISOString(),
      is_active: true,
    };
  };

  // API helper function
  const apiCall = async <T,>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> => {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...options?.headers,
      };

      // Add authorization header if user is authenticated
      if (authState.session?.access_token) {
        (headers as Record<string, string>)[
          "Authorization"
        ] = `Bearer ${authState.session.access_token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers,
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "API request failed");
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
      await apiCall("/health");
      setApiConnected(true);
      return true;
    } catch (error) {
      console.error("API connection failed:", error);
      setApiConnected(false);
      return false;
    }
  };

  // Fetch entries from API
  const fetchEntries = async () => {
    try {
      const response = await apiCall<{ trades: JournalEntry[] }>(
        `/trades?limit=1000`
      );

      if (response.trades) {
        const formattedEntries = response.trades.map((entry: JournalEntry) => ({
          ...entry,
          entry_dt: new Date(entry.entry_dt).toISOString().slice(0, 16),
          exit_dt: entry.exit_dt
            ? new Date(entry.exit_dt).toISOString().slice(0, 16)
            : undefined,
        }));

        setEntries(formattedEntries);
        console.log(`Fetched ${formattedEntries.length} entries from API`);
      }
    } catch (error) {
      console.error("Failed to fetch entries:", error);
    }
  };

  // Fetch statistics from API
  const fetchStatistics = async () => {
    try {
      const stats = await apiCall<Statistics>(`/analytics/stats`);
      setStatistics(stats);
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
    }
  };

  // Fetch advanced analytics
  const fetchAdvancedStats = async () => {
    try {
      const response = await apiCall<{ stats: AdvancedStats }>(
        `/analytics/advanced-stats`
      );
      if (response.stats) {
        setAdvancedStats(response.stats);
      }
    } catch (error) {
      console.error("Failed to fetch advanced stats:", error);
    }
  };

  // Fetch time series data - FIXED: Removed useCallback
  const fetchTimeSeriesData = async () => {
    try {
      const response = await apiCall<{ data: TimeSeriesData[] }>(
        `/analytics/time-series?period=${selectedPeriod}`
      );
      if (response.data) {
        setTimeSeriesData(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch time series data:", error);
    }
  };

  const fetchPatternData = async () => {
    try {
      const response = await apiCall<{ patterns: PatternData }>(
        `/analytics/patterns`
      );
      if (response.patterns) {
        setPatternData(response.patterns);
      }
    } catch (error) {
      console.error("Failed to fetch pattern data:", error);
    }
  };

  // Initialize trading data after authentication - FIXED: Removed useCallback
  const initializeTradingData = async () => {
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
      console.warn("Unable to connect to the backend API.");
    }
    setLoading(false);
  };

  // Initialize Supabase auth listener
  useEffect(() => {
    let isMounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting initial session:", error);
          setError(error.message);
        }

        if (isMounted) {
          if (session?.user) {
            const userData = convertSupabaseUser(session.user);
            setAuthState({
              user: userData,
              session,
              loading: false,
            });
            // Initialize trading data
            await initializeTradingData();
          } else {
            setAuthState({ user: null, session: null, loading: false });
          }
        }
      } catch (error) {
        console.error("Error in getInitialSession:", error);
        if (isMounted) {
          setAuthState({ user: null, session: null, loading: false });
          setError(
            error instanceof Error ? error.message : "Authentication error"
          );
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log("Auth state changed:", event, session?.user?.email);

        if (isMounted) {
          if (event === "SIGNED_IN" && session?.user) {
            const userData = convertSupabaseUser(session.user);
            setAuthState({
              user: userData,
              session,
              loading: false,
            });
            setError(null);
            // Initialize trading data
            await initializeTradingData();
          } else if (event === "SIGNED_OUT") {
            setAuthState({ user: null, session: null, loading: false });
            // Reset trading journal state
            setEntries([]);
            setStatistics(null);
            setAdvancedStats(null);
            setTimeSeriesData([]);
            setPatternData(null);
            setAnalytics(null);
          } else if (event === "TOKEN_REFRESHED" && session?.user) {
            const userData = convertSupabaseUser(session.user);
            setAuthState({
              user: userData,
              session,
              loading: false,
            });
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - this effect only runs once on mount

  // Handle Google sign in with Supabase
  const handleGoogleSignIn = async () => {
    setSignInLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);

      // Check if it's a provider configuration error
      if (
        error instanceof Error &&
        error.message.includes("provider is not enabled")
      ) {
        setError(
          "Google OAuth is not configured. Please enable Google provider in Supabase Dashboard → Authentication → Providers"
        );
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to sign in with Google"
        );
      }
    } finally {
      setSignInLoading(false);
    }
  };

  // Handle sign out with Supabase
  const handleSignOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Error signing out:", error);
      setError(error instanceof Error ? error.message : "Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  // Refetch time series data when period changes - FIXED: Now uses regular function
  useEffect(() => {
    if (apiConnected && authState.user) {
      fetchTimeSeriesData();
    }
  }, [selectedPeriod, apiConnected, authState.user]); // Clean dependency array

  // Save entry to API
  const saveEntry = async (entry: Omit<JournalEntry, "s_no">) => {
    try {
      const response = await apiCall<{ trade: JournalEntry }>("/trades", {
        method: "POST",
        body: JSON.stringify(entry),
      });

      if (response.trade) {
        const formattedEntry = {
          ...response.trade,
          entry_dt: new Date(response.trade.entry_dt)
            .toISOString()
            .slice(0, 16),
          exit_dt: response.trade.exit_dt
            ? new Date(response.trade.exit_dt).toISOString().slice(0, 16)
            : undefined,
        };

        console.log("Entry saved successfully:", formattedEntry.s_no);
        return formattedEntry;
      }
      throw new Error("Invalid response from server");
    } catch (error) {
      console.error("Failed to save entry:", error);
      throw error;
    }
  };

  // Update entry via API
  const updateEntry = async (entry: JournalEntry) => {
    try {
      const response = await apiCall<{ trade: JournalEntry }>(
        `/trades/${entry.s_no}`,
        {
          method: "PUT",
          body: JSON.stringify(entry),
        }
      );

      if (response.trade) {
        const formattedEntry = {
          ...response.trade,
          entry_dt: new Date(response.trade.entry_dt)
            .toISOString()
            .slice(0, 16),
          exit_dt: response.trade.exit_dt
            ? new Date(response.trade.exit_dt).toISOString().slice(0, 16)
            : undefined,
        };

        console.log("Entry updated successfully:", formattedEntry.s_no);
        return formattedEntry;
      }
      throw new Error("Invalid response from server");
    } catch (error) {
      console.error("Failed to update entry:", error);
      throw error;
    }
  };

  // Delete entry via API
  const deleteEntry = async (sNo: number) => {
    try {
      await apiCall(`/trades/${sNo}`, {
        method: "DELETE",
      });
      console.log("Entry deleted successfully:", sNo);
    } catch (error) {
      console.error("Failed to delete entry:", error);
      throw error;
    }
  };

  // Calculate strategy based on duration
  const calculateStrategy = (entryDt: string, exitDt?: string): string => {
    if (!exitDt) return "open_position";

    const entryTime = new Date(entryDt).getTime();
    const exitTime = new Date(exitDt).getTime();
    const durationHours = (exitTime - entryTime) / (1000 * 60 * 60);

    if (durationHours <= 1) return "scalping";
    if (durationHours <= 24) return "intraday";
    if (durationHours <= 168) return "swing";
    if (durationHours <= 744) return "positional";
    return "long_term";
  };

  // Calculate P&L
  const calculatePnL = (
    qty: number,
    entryPrice: number,
    exitPrice?: number,
    commission: number = 0,
    direction: "buy" | "sell" = "buy"
  ): number | undefined => {
    if (!exitPrice) return undefined;

    let pnl: number;
    if (direction === "buy") {
      pnl = qty * (exitPrice - entryPrice) - commission;
    } else {
      pnl = qty * (entryPrice - exitPrice) - commission;
    }

    return pnl;
  };

  // Handle form submission - FIXED: Now calls regular functions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiConnected || !authState.user) {
      alert(
        "API connection not available or user not authenticated. Please refresh the page or sign in again."
      );
      return;
    }

    setLoading(true);

    try {
      const entryDateTime =
        formData.entry_dt || new Date().toISOString().slice(0, 16);
      const exitDateTime = formData.exit_dt || undefined;
      const exitPrice = formData.exit_price
        ? parseFloat(formData.exit_price)
        : undefined;
      const qty = parseFloat(formData.qty);
      const entryPrice = parseFloat(formData.entry_price);
      const commission = parseFloat(formData.commission);

      const strategy =
        formData.strategy || calculateStrategy(entryDateTime, exitDateTime);
      const pnl = calculatePnL(
        qty,
        entryPrice,
        exitPrice,
        commission,
        formData.direction
      );
      const status: "open" | "closed" =
        exitPrice && exitDateTime ? "closed" : "open";

      const entryData = {
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
        reason: formData.reason,
      };

      if (editingEntry) {
        const updatedEntry = await updateEntry({
          ...entryData,
          s_no: editingEntry.s_no,
        });
        setEntries(
          entries.map((entry) =>
            entry.s_no === editingEntry.s_no ? updatedEntry : entry
          )
        );
        alert("Trade updated successfully!");
      } else {
        const savedEntry = await saveEntry(entryData);
        setEntries([savedEntry, ...entries]);
        alert("Trade saved successfully!");
      }

      // Refresh all data after successful save/update
      await Promise.all([
        fetchStatistics(),
        fetchAdvancedStats(),
        fetchTimeSeriesData(),
        fetchPatternData(),
      ]);
      resetForm();
    } catch (error) {
      console.error("Failed to save entry:", error);
      alert(
        `Failed to save entry. ${
          error instanceof Error
            ? error.message
            : "Please check your input and try again."
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      broker: "",
      market: "",
      instrument: "",
      direction: "buy",
      qty: "",
      entry_price: "",
      exit_price: "",
      entry_dt: "",
      exit_dt: "",
      stoploss: "",
      commission: "",
      strategy: "",
      setup: "",
      reason: "",
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
      exit_price: entry.exit_price?.toString() || "",
      entry_dt: entry.entry_dt,
      exit_dt: entry.exit_dt || "",
      stoploss: entry.stoploss.toString(),
      commission: entry.commission.toString(),
      strategy: entry.strategy,
      setup: entry.setup || "",
      reason: entry.reason || "",
    });
    setShowForm(true);
  };

  // Handle delete with data refresh - FIXED: Now calls regular functions
  const handleDelete = async (sNo: number) => {
    if (!authState.user) return;

    if (window.confirm("Are you sure you want to delete this trade?")) {
      try {
        setLoading(true);
        await deleteEntry(sNo);
        setEntries(entries.filter((entry) => entry.s_no !== sNo));

        // Refresh all data after successful delete
        await Promise.all([
          fetchStatistics(),
          fetchAdvancedStats(),
          fetchTimeSeriesData(),
          fetchPatternData(),
        ]);
        alert("Trade deleted successfully!");
      } catch (error) {
        console.error("Failed to delete entry:", error);
        alert(
          `Failed to delete entry. ${
            error instanceof Error ? error.message : "Please try again."
          }`
        );
      } finally {
        setLoading(false);
      }
    }
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    if (filter !== "all" && entry.status !== filter) return false;
    if (strategyFilter !== "all" && entry.strategy !== strategyFilter)
      return false;
    return true;
  });

  // Get statistics with fallback to calculated values
  const stats = statistics || {
    total_trades: entries.length,
    open_trades: entries.filter((e) => e.status === "open").length,
    closed_trades: entries.filter((e) => e.status === "closed").length,
    total_pnl: entries.reduce((sum, entry) => sum + (entry.p_and_l || 0), 0),
    avg_pnl:
      entries.length > 0
        ? entries.reduce((sum, entry) => sum + (entry.p_and_l || 0), 0) /
          entries.length
        : 0,
    winning_trades: entries.filter((e) => (e.p_and_l || 0) > 0).length,
    losing_trades: entries.filter((e) => (e.p_and_l || 0) < 0).length,
    best_trade: Math.max(...entries.map((e) => e.p_and_l || 0), 0),
    worst_trade: Math.min(...entries.map((e) => e.p_and_l || 0), 0),
    win_rate:
      entries.filter((e) => e.status === "closed").length > 0
        ? (entries.filter((e) => (e.p_and_l || 0) > 0).length /
            entries.filter((e) => e.status === "closed").length) *
          100
        : 0,
  };

  const strategies = Array.from(new Set(entries.map((e) => e.strategy)));

  // Helper functions for advanced radar charts
  const prepareComprehensiveRadarData = () => {
    if (!advancedStats || !stats) return [];

    return [
      {
        metric: "Win Rate",
        value: Math.min(stats.win_rate, 100),
        fullMark: 100,
      },
      {
        metric: "Profit Factor",
        value: Math.min(advancedStats.basic.profitFactor * 20, 100),
        fullMark: 100,
      },
      {
        metric: "Sharpe Ratio",
        value: Math.min(
          Math.max(advancedStats.risk.sharpeRatio * 25 + 50, 0),
          100
        ),
        fullMark: 100,
      },
      {
        metric: "Risk/Reward",
        value: Math.min(advancedStats.performance.riskRewardRatio * 25, 100),
        fullMark: 100,
      },
      {
        metric: "Consistency",
        value: Math.max(100 - advancedStats.risk.volatility * 100, 0),
        fullMark: 100,
      },
      {
        metric: "Expectancy",
        value: Math.min(Math.max(advancedStats.basic.expectancy + 50, 0), 100),
        fullMark: 100,
      },
      {
        metric: "Calmar Ratio",
        value: Math.min(
          Math.max(advancedStats.risk.calmarRatio * 20 + 50, 0),
          100
        ),
        fullMark: 100,
      },
      {
        metric: "Kelly %",
        value: Math.min(
          Math.max(advancedStats.performance.kellyPercentage + 50, 0),
          100
        ),
        fullMark: 100,
      },
    ];
  };

  const prepareRiskRadarData = () => {
    if (!advancedStats) return [];

    return [
      {
        metric: "Low Volatility",
        value: Math.max(100 - advancedStats.risk.volatility * 100, 0),
        fullMark: 100,
      },
      {
        metric: "Low Drawdown",
        value: Math.max(100 - advancedStats.risk.maxDrawdown * 100, 0),
        fullMark: 100,
      },
      {
        metric: "VaR 95%",
        value: Math.max(100 - Math.abs(advancedStats.risk.var95) * 10, 0),
        fullMark: 100,
      },
      {
        metric: "VaR 99%",
        value: Math.max(100 - Math.abs(advancedStats.risk.var99) * 10, 0),
        fullMark: 100,
      },
      {
        metric: "Sharpe Ratio",
        value: Math.min(
          Math.max(advancedStats.risk.sharpeRatio * 25 + 50, 0),
          100
        ),
        fullMark: 100,
      },
    ];
  };

  const prepareDayOfWeekData = () => {
    if (!patternData) return [];

    const dayOrder = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    return dayOrder
      .map((day) => ({
        day: day.slice(0, 3),
        ...(patternData.dayOfWeekPerformance[day] || {
          trades: 0,
          totalPnL: 0,
          winRate: 0,
        }),
      }))
      .filter((d) => d.trades > 0);
  };

  const prepareInstrumentData = () => {
    if (!patternData) return [];

    return Object.entries(patternData.instrumentPerformance)
      .map(([instrument, data]) => ({
        instrument,
        ...data,
      }))
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, 10);
  };

  // Advanced Analytics Functions
  const generateAdvancedAnalytics = async () => {
    if (entries.length === 0) {
      alert("No trading data available for analysis.");
      return;
    }

    setLoading(true);
    try {
      const analyticsData = {
        totalTrades: entries.length,
        closedTrades: entries.filter((e) => e.status === "closed").length,
        totalPnL: entries.reduce((sum, e) => sum + (e.p_and_l || 0), 0),
        winRate:
          entries.filter((e) => e.status === "closed").length > 0
            ? (entries.filter((e) => (e.p_and_l || 0) > 0).length /
                entries.filter((e) => e.status === "closed").length) *
              100
            : 0,
        strategies: Array.from(new Set(entries.map((e) => e.strategy))),
        avgPnL:
          entries.length > 0
            ? entries.reduce((sum, e) => sum + (e.p_and_l || 0), 0) /
              entries.length
            : 0,
        bestPerformingStrategy: (() => {
          const strategyPerf = Array.from(
            new Set(entries.map((e) => e.strategy))
          ).map((strategy) => {
            const trades = entries.filter((e) => e.strategy === strategy);
            const pnl = trades.reduce((sum, t) => sum + (t.p_and_l || 0), 0);
            return { strategy, pnl, trades: trades.length };
          });
          return strategyPerf.sort((a, b) => b.pnl - a.pnl)[0];
        })(),
        instruments: Array.from(new Set(entries.map((e) => e.instrument))),
        markets: Array.from(new Set(entries.map((e) => e.market))),
        brokers: Array.from(new Set(entries.map((e) => e.broker))),
        timeRange: {
          firstTrade:
            entries.length > 0 ? entries[entries.length - 1].entry_dt : null,
          lastTrade: entries.length > 0 ? entries[0].entry_dt : null,
        },
        riskMetrics: {
          maxLoss: Math.min(...entries.map((e) => e.p_and_l || 0), 0),
          maxWin: Math.max(...entries.map((e) => e.p_and_l || 0), 0),
          avgWin:
            entries.filter((e) => (e.p_and_l || 0) > 0).length > 0
              ? entries
                  .filter((e) => (e.p_and_l || 0) > 0)
                  .reduce((sum, e) => sum + (e.p_and_l || 0), 0) /
                entries.filter((e) => (e.p_and_l || 0) > 0).length
              : 0,
          avgLoss:
            entries.filter((e) => (e.p_and_l || 0) < 0).length > 0
              ? entries
                  .filter((e) => (e.p_and_l || 0) < 0)
                  .reduce((sum, e) => sum + (e.p_and_l || 0), 0) /
                entries.filter((e) => (e.p_and_l || 0) < 0).length
              : 0,
        },
      };

      const response = await fetch(
        "https://oi-server.onrender.com/chat/completions",
        {
          method: "POST",
          headers: {
            customerId: "cus_T16LkQBOoDWzQN",
            "Content-Type": "application/json",
            Authorization: "Bearer xxx",
          },
          body: JSON.stringify({
            model: "openrouter/claude-sonnet-4",
            messages: [
              {
                role: "system",
                content: `You are an elite quantitative analyst and professional trader with deep expertise in financial markets and trading psychology. Analyze the provided trading data and provide comprehensive insights in JSON format that would be valuable to an experienced trader.

              Provide analysis in this exact JSON structure:
              {
                "executive_summary": {
                  "overall_performance": "comprehensive assessment",
                  "key_strengths": ["strength1", "strength2", "strength3"],
                  "critical_weaknesses": ["weakness1", "weakness2", "weakness3"],
                  "trader_profile": "assessment of trading style and personality"
                },
                "performance_metrics": {
                  "sharpe_ratio": "calculated or estimated value with explanation",
                  "sortino_ratio": "calculated or estimated value",
                  "max_drawdown": "percentage with analysis",
                  "profit_factor": "ratio with interpretation",
                  "return_on_investment": "percentage with context",
                  "calmar_ratio": "value with explanation",
                  "recovery_factor": "assessment"
                },
                "risk_analysis": {
                  "risk_management_score": "score out of 100 with justification",
                  "position_sizing": "assessment of position sizing discipline",
                  "risk_reward_analysis": "detailed analysis of R:R ratios",
                  "drawdown_analysis": "patterns and recovery analysis",
                  "volatility_assessment": "trading consistency evaluation",
                  "tail_risk": "assessment of extreme loss events"
                },
                "strategy_analysis": {
                  "strategy_effectiveness": "ranking and analysis of each strategy",
                  "market_adaptability": "how well strategies adapt to market conditions",
                  "diversification_score": "assessment of strategy diversification",
                  "optimization_opportunities": ["specific optimization suggestions"],
                  "strategy_allocation_recommendation": "suggested allocation between strategies"
                },
                "psychological_analysis": {
                  "discipline_score": "score out of 100",
                  "emotional_control": "assessment based on trading patterns",
                  "consistency_patterns": "behavioral consistency analysis",
                  "tilt_indicators": "signs of emotional trading or revenge trading",
                  "improvement_areas": ["specific psychological areas to work on"]
                },
                "market_insights": {
                  "best_performing_instruments": ["top instruments with reasons"],
                  "worst_performing_instruments": ["bottom instruments with analysis"],
                  "market_timing_analysis": "assessment of entry/exit timing",
                  "seasonal_patterns": "any identified seasonal trends",
                  "correlation_insights": "insights about instrument correlations"
                },
                "actionable_recommendations": {
                  "immediate_actions": ["urgent recommendations for next 30 days"],
                  "medium_term_improvements": ["recommendations for next 3-6 months"],
                  "long_term_development": ["strategic improvements for 6+ months"],
                  "risk_management_changes": ["specific risk management improvements"],
                  "system_modifications": ["trading system and process improvements"]
                },
                "advanced_analytics": {
                  "kelly_criterion": "optimal position sizing recommendation",
                  "var_analysis": "Value at Risk assessment",
                  "stress_testing": "how portfolio performs under stress",
                  "correlation_matrix": "key correlations identified",
                  "regime_analysis": "performance in different market regimes"
                },
                "benchmarking": {
                  "vs_market": "performance vs relevant market indices",
                  "vs_peers": "estimated performance vs peer traders",
                  "percentile_ranking": "estimated ranking percentile",
                  "improvement_potential": "realistic improvement expectations"
                }
              }

              Return only valid JSON without any markdown formatting or explanations. Be specific, quantitative, and actionable in your analysis.`,
              },
              {
                role: "user",
                content: `Analyze this comprehensive trading portfolio data:

              PORTFOLIO OVERVIEW:
              - Total Trades: ${analyticsData.totalTrades}
              - Closed Trades: ${analyticsData.closedTrades}
              - Total P&L: ₹${analyticsData.totalPnL.toFixed(2)}
              - Win Rate: ${analyticsData.winRate.toFixed(1)}%
              - Average P&L per Trade: ₹${analyticsData.avgPnL.toFixed(2)}
              
              TRADING UNIVERSE:
              - Strategies: ${analyticsData.strategies.join(", ")}
              - Instruments: ${analyticsData.instruments.join(", ")}
              - Markets: ${analyticsData.markets.join(", ")}
              - Brokers: ${analyticsData.brokers.join(", ")}
              
              RISK METRICS:
              - Maximum Single Loss: ₹${analyticsData.riskMetrics.maxLoss.toFixed(
                2
              )}
              - Maximum Single Win: ₹${analyticsData.riskMetrics.maxWin.toFixed(
                2
              )}
              - Average Winning Trade: ₹${analyticsData.riskMetrics.avgWin.toFixed(
                2
              )}
              - Average Losing Trade: ₹${analyticsData.riskMetrics.avgLoss.toFixed(
                2
              )}
              
              BEST PERFORMING STRATEGY: 
              ${
                analyticsData.bestPerformingStrategy?.strategy
              } - ₹${analyticsData.bestPerformingStrategy?.pnl.toFixed(
                  2
                )} from ${analyticsData.bestPerformingStrategy?.trades} trades
              
              TIME RANGE: 
              ${analyticsData.timeRange.firstTrade} to ${
                  analyticsData.timeRange.lastTrade
                }

              DETAILED TRADE DATA:
              ${JSON.stringify(entries.slice(-100), null, 2)}`,
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `API request failed with status ${
            response.status
          }: ${await response.text()}`
        );
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid API response format");
      }

      try {
        const analyticsResult = JSON.parse(data.choices[0].message.content);
        setAnalytics(analyticsResult);
      } catch (parseError) {
        console.error(
          "Failed to parse analytics JSON from AI response:",
          parseError
        );
        // Fallback analytics
        setAnalytics({
          executive_summary: {
            overall_performance: `Based on ${
              analyticsData.totalTrades
            } trades with a ${analyticsData.winRate.toFixed(
              1
            )}% win rate and total P&L of ₹${analyticsData.totalPnL.toFixed(
              2
            )}`,
            key_strengths: [
              analyticsData.winRate > 50
                ? "Positive win rate indicates good trade selection"
                : "Room for improvement in trade selection",
              analyticsData.totalPnL > 0
                ? "Profitable trading overall"
                : "Focus on improving profitability",
              `Active in ${analyticsData.strategies.length} different strategies showing diversification`,
            ],
            critical_weaknesses: [
              analyticsData.winRate < 50
                ? "Win rate below 50% needs improvement"
                : "Consider optimizing winning trade size",
              analyticsData.totalTrades < 20
                ? "Limited sample size for statistical significance"
                : "Ensure consistent execution",
              "Consider implementing stricter risk management rules",
            ],
            trader_profile: analyticsData.strategies.includes("scalping")
              ? "Active short-term trader"
              : "Swing/position trader",
          },
          performance_metrics: {
            profit_factor:
              analyticsData.riskMetrics.avgWin > 0 &&
              analyticsData.riskMetrics.avgLoss < 0
                ? (
                    analyticsData.riskMetrics.avgWin /
                    Math.abs(analyticsData.riskMetrics.avgLoss)
                  ).toFixed(2)
                : "Insufficient data",
            return_on_investment: `${(
              (analyticsData.totalPnL /
                Math.max(analyticsData.totalTrades * 1000, 1)) *
              100
            ).toFixed(2)}%`,
          },
          actionable_recommendations: {
            immediate_actions: [
              `Your current win rate is ${analyticsData.winRate.toFixed(1)}%. ${
                analyticsData.winRate > 50
                  ? "Focus on increasing position sizes for winning trades."
                  : "Review and improve entry criteria."
              }`,
              `Best performing strategy: ${analyticsData.bestPerformingStrategy?.strategy}. Consider allocating more capital here.`,
              "Implement consistent position sizing rules based on account balance.",
              "Set up daily trading journal reviews to identify patterns.",
              "Establish strict risk-per-trade limits (recommend 1-2% of capital per trade).",
            ],
          },
        });
      }
    } catch (error) {
      console.error("Advanced analytics generation failed:", error);
      alert(
        `Failed to generate AI insights. Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  // Chart data preparation
  const prepareChartData = () => {
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(a.entry_dt).getTime() - new Date(b.entry_dt).getTime()
    );

    let cumulativePnL = 0;
    const cumulativePnLData = sortedEntries.map((entry, index) => {
      if (entry.p_and_l) cumulativePnL += entry.p_and_l;
      return {
        trade: index + 1,
        pnl: entry.p_and_l || 0,
        cumulativePnL: cumulativePnL,
        date: new Date(entry.entry_dt).toLocaleDateString(),
        strategy: entry.strategy,
        instrument: entry.instrument,
      };
    });

    const strategyPerformance = strategies.map((strategy) => {
      const strategyTrades = entries.filter((e) => e.strategy === strategy);
      const totalPnL = strategyTrades.reduce(
        (sum, trade) => sum + (trade.p_and_l || 0),
        0
      );
      const winRate =
        strategyTrades.length > 0
          ? (strategyTrades.filter((t) => (t.p_and_l || 0) > 0).length /
              strategyTrades.length) *
            100
          : 0;

      return {
        strategy,
        totalPnL,
        winRate: parseFloat(winRate.toFixed(1)),
        trades: strategyTrades.length,
        avgPnL:
          strategyTrades.length > 0 ? totalPnL / strategyTrades.length : 0,
      };
    });

    const monthlyData = entries.reduce(
      (
        acc: {
          [key: string]: {
            month: string;
            trades: number;
            pnl: number;
            wins: number;
          };
        },
        entry
      ) => {
        const month = new Date(entry.entry_dt).toISOString().slice(0, 7);
        if (!acc[month]) {
          acc[month] = { month, trades: 0, pnl: 0, wins: 0 };
        }
        acc[month].trades += 1;
        acc[month].pnl += entry.p_and_l || 0;
        if ((entry.p_and_l || 0) > 0) acc[month].wins += 1;
        return acc;
      },
      {}
    );

    const monthlyPerformance = Object.values(monthlyData).map(
      (data: { month: string; trades: number; pnl: number; wins: number }) => ({
        ...data,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      })
    );

    const riskDistribution = entries
      .filter((e) => e.p_and_l !== undefined && e.stoploss !== undefined)
      .map((e) => {
        const risk = Math.abs(e.entry_price - e.stoploss) * e.qty;
        const reward = e.p_and_l || 0;
        return {
          risk,
          reward,
          rMultiple: risk > 0 ? reward / risk : 0,
          instrument: e.instrument,
          strategy: e.strategy,
        };
      });

    // Premium color palette for charts
    const pnlDistribution = [
      {
        name: "Profitable Trades",
        value: entries.filter((e) => (e.p_and_l || 0) > 0).length,
        fill: "#10b981",
      },
      {
        name: "Losing Trades",
        value: entries.filter((e) => (e.p_and_l || 0) < 0).length,
        fill: "#ef4444",
      },
      {
        name: "Break-even Trades",
        value: entries.filter((e) => (e.p_and_l || 0) === 0).length,
        fill: "#8b5cf6",
      },
    ];

    return {
      cumulativePnLData,
      strategyPerformance,
      monthlyPerformance,
      riskDistribution,
      pnlDistribution,
    };
  };

  const chartData = prepareChartData();

  // Loading state with premium styling
  if (authState.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center font-['Inter'] antialiased">
        <Card className="w-full max-w-md mx-4 border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="relative">
              <div className="animate-spin inline-block w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mb-6"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <p className="text-slate-600 font-medium">
              Initializing TradingJournal Pro...
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Connecting to Supabase and loading analytics
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Premium Sign in state
  if (!authState.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4 font-['Inter'] antialiased">
        <div className="w-full max-w-lg">
          {/* Premium Logo and branding */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-3xl mb-6 shadow-xl">
              <TrendingUp className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent mb-3">
              TradingJournal Pro
            </h1>
            <p className="text-lg text-slate-600 font-medium">
              Elite Trading Analytics Platform
            </p>
            <p className="text-slate-500">
              Powered by AI insights and advanced analytics
            </p>
          </div>

          {/* Premium Sign in card */}
          <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-xl">
            <CardHeader className="text-center pb-8 pt-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Crown className="w-6 h-6 text-amber-500" />
                <CardTitle className="text-2xl font-bold text-slate-800">
                  Welcome Back
                </CardTitle>
                <Crown className="w-6 h-6 text-amber-500" />
              </div>
              <CardDescription className="text-slate-600 text-base leading-relaxed">
                Access your professional trading dashboard with AI-powered
                insights, advanced analytics, and comprehensive performance
                tracking
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8 px-8 pb-8">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
                    <p className="text-sm text-red-800 font-medium">{error}</p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleGoogleSignIn}
                disabled={signInLoading}
                className="w-full h-14 bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 hover:border-gray-300 font-semibold transition-all duration-300 shadow-lg hover:shadow-xl rounded-xl"
              >
                {signInLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-indigo-600 rounded-full mr-3"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
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
                  <span className="px-4 bg-white text-slate-500 font-medium">
                    Premium features included
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 text-center text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-semibold text-slate-700">
                    AI Insights
                  </span>
                  <span className="text-xs text-slate-500">
                    Smart Analytics
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-semibold text-slate-700">
                    Analytics
                  </span>
                  <span className="text-xs text-slate-500">
                    Advanced Charts
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-semibold text-slate-700">Secure</span>
                  <span className="text-xs text-slate-500">Bank Grade</span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-amber-500 fill-current" />
                  <span className="text-sm font-semibold text-slate-700">
                    All Premium Features Included
                  </span>
                  <Star className="w-4 h-4 text-amber-500 fill-current" />
                </div>
                <p className="text-xs text-slate-600 text-center">
                  No subscriptions • No hidden fees • Full access forever
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Premium Footer */}
          <div className="text-center mt-8 space-y-2">
            <p className="text-slate-600 font-medium">
              Trusted by professional traders worldwide
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>Enterprise Security</span>
              </div>
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>Global Access</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>Real-time Data</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated state - Premium dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-['Inter'] antialiased">
      {/* Premium Header */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                    TradingJournal Pro
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Elite Analytics Platform
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-slate-50 rounded-xl px-4 py-2">
                {authState.user.avatar_url && (
                  <img
                    src={authState.user.avatar_url}
                    alt="Professional trader avatar"
                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                  />
                )}
                <div className="text-sm">
                  <div className="font-semibold text-slate-800">
                    {authState.user.full_name}
                  </div>
                  <div className="text-slate-500">{authState.user.email}</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg">
                  <Crown className="w-3 h-3" />
                  <span>PRO</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {loading ? "Signing out..." : "Sign Out"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Premium Navigation Tabs */}
        <div className="flex flex-wrap gap-3 mb-8 p-2 bg-white/80 rounded-2xl border border-slate-200 backdrop-blur-sm shadow-lg">
          {[
            { key: "dashboard", label: "Dashboard", icon: BarChart3 },
            { key: "analytics", label: "Analytics", icon: LineChartIcon },
            { key: "patterns", label: "Patterns", icon: Target },
            { key: "insights", label: "AI Insights", icon: Brain },
            { key: "trades", label: "Trades", icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? "default" : "ghost"}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {/* Dashboard Tab - Premium Design */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* Premium Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold mb-1">
                        {stats.total_trades}
                      </div>
                      <div className="text-blue-100 font-medium">
                        Total Trades
                      </div>
                    </div>
                    <Activity className="w-8 h-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold mb-1">
                        {stats.open_trades}
                      </div>
                      <div className="text-amber-100 font-medium">
                        Open Trades
                      </div>
                    </div>
                    <Unlock className="w-8 h-8 text-amber-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold mb-1">
                        {stats.closed_trades}
                      </div>
                      <div className="text-purple-100 font-medium">
                        Closed Trades
                      </div>
                    </div>
                    <Lock className="w-8 h-8 text-purple-200" />
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`border-0 shadow-xl text-white ${
                  stats.total_pnl >= 0
                    ? "bg-gradient-to-br from-green-500 to-emerald-600"
                    : "bg-gradient-to-br from-red-500 to-pink-600"
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold mb-1">
                        ₹{stats.total_pnl.toFixed(2)}
                      </div>
                      <div
                        className={`font-medium ${
                          stats.total_pnl >= 0
                            ? "text-green-100"
                            : "text-red-100"
                        }`}
                      >
                        Total P&L
                      </div>
                    </div>
                    {stats.total_pnl >= 0 ? (
                      <TrendingUp className="w-8 h-8 text-green-200" />
                    ) : (
                      <TrendingDown className="w-8 h-8 text-red-200" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold mb-1">
                        {stats.win_rate.toFixed(1)}%
                      </div>
                      <div className="text-cyan-100 font-medium">Win Rate</div>
                    </div>
                    <Target className="w-8 h-8 text-cyan-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Advanced Stats Cards with Premium Design */}
            {advancedStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-0 shadow-xl bg-white hover:shadow-2xl transition-shadow duration-300">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                          Profit Factor
                        </p>
                        <p className="text-3xl font-bold text-green-600">
                          {advancedStats.basic.profitFactor.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Gross profit / Gross loss
                        </p>
                      </div>
                      <div className="h-16 w-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-8 h-8 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-white hover:shadow-2xl transition-shadow duration-300">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                          Sharpe Ratio
                        </p>
                        <p className="text-3xl font-bold text-blue-600">
                          {advancedStats.risk.sharpeRatio.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Risk-adjusted return
                        </p>
                      </div>
                      <div className="h-16 w-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center">
                        <BarChart3 className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-white hover:shadow-2xl transition-shadow duration-300">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                          Max Drawdown
                        </p>
                        <p className="text-3xl font-bold text-red-600">
                          {(advancedStats.risk.maxDrawdown * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Maximum portfolio decline
                        </p>
                      </div>
                      <div className="h-16 w-16 bg-gradient-to-br from-red-100 to-pink-100 rounded-2xl flex items-center justify-center">
                        <TrendingDown className="w-8 h-8 text-red-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-white hover:shadow-2xl transition-shadow duration-300">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                          Annual Return
                        </p>
                        <p className="text-3xl font-bold text-purple-600">
                          {(
                            advancedStats.performance.annualReturn * 100
                          ).toFixed(1)}
                          %
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Annualized performance
                        </p>
                      </div>
                      <div className="h-16 w-16 bg-gradient-to-br from-purple-100 to-violet-100 rounded-2xl flex items-center justify-center">
                        <DollarSign className="w-8 h-8 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Premium Performance Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Cumulative P&L Chart */}
              <Card className="border-0 shadow-xl bg-white">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <LineChartIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800">
                        Cumulative P&L
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        Your trading performance over time
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData.cumulativePnLData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="trade"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        stroke="#94a3b8"
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        stroke="#94a3b8"
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          `₹${value.toFixed(2)}`,
                          name === "cumulativePnL"
                            ? "Cumulative P&L"
                            : "Trade P&L",
                        ]}
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulativePnL"
                        stroke="url(#gradient1)"
                        strokeWidth={3}
                        name="cumulativePnL"
                        dot={{ fill: "#6366f1", strokeWidth: 2, r: 4 }}
                      />
                      <defs>
                        <linearGradient
                          id="gradient1"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* P&L Distribution Pie Chart */}
              <Card className="border-0 shadow-xl bg-white">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <PieChartIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800">
                        Trade Distribution
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        Breakdown of profitable vs losing trades
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={chartData.pnlDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) =>
                          `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {chartData.pnlDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Premium Quick Actions */}
            <div className="flex flex-wrap gap-4 justify-center bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl p-8 border border-slate-200">
              <Button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-3 rounded-xl font-semibold"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add New Trade
              </Button>
              <Button
                onClick={generateAdvancedAnalytics}
                variant="outline"
                disabled={loading || entries.length === 0}
                className="border-2 border-slate-300 hover:border-indigo-300 hover:bg-indigo-50 px-8 py-3 rounded-xl font-semibold transition-all duration-300"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5 mr-2" />
                    Generate AI Insights
                  </>
                )}
              </Button>
              <Button
                onClick={() => setActiveTab("analytics")}
                variant="outline"
                className="border-2 border-slate-300 hover:border-blue-300 hover:bg-blue-50 px-8 py-3 rounded-xl font-semibold transition-all duration-300"
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                View Advanced Analytics
              </Button>
            </div>
          </div>
        )}

        {/* Analytics Tab - Enhanced with Premium Design */}
        {activeTab === "analytics" && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">
                    Advanced Analytics
                  </h2>
                  <p className="text-slate-600">
                    Professional trading performance analysis
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Select
                  value={selectedPeriod}
                  onValueChange={(value: any) => setSelectedPeriod(value)}
                >
                  <SelectTrigger className="w-40 h-12 border-2 border-slate-200 rounded-xl">
                    <SelectValue />
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </SelectTrigger>
                </Select>
                <Button
                  onClick={generateAdvancedAnalytics}
                  disabled={loading || entries.length === 0}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Generate AI Insights
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Comprehensive Performance Radar */}
            {advancedStats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-0 shadow-xl bg-white">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <RadarIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-slate-800">
                          Performance Radar
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                          Multi-dimensional performance analysis
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart data={prepareComprehensiveRadarData()}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis
                          dataKey="metric"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                        />
                        <PolarRadiusAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 9, fill: "#94a3b8" }}
                        />
                        <Radar
                          name="Performance"
                          dataKey="value"
                          stroke="#6366f1"
                          fill="#6366f1"
                          fillOpacity={0.2}
                          strokeWidth={3}
                        />
                        <Tooltip
                          formatter={(value: any) => [
                            `${value.toFixed(1)}`,
                            "Score",
                          ]}
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e2e8f0",
                            borderRadius: "12px",
                            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-white">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
                        <Shield className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-slate-800">
                          Risk Management
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                          Risk control and management assessment
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart data={prepareRiskRadarData()}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis
                          dataKey="metric"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                        />
                        <PolarRadiusAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 9, fill: "#94a3b8" }}
                        />
                        <Radar
                          name="Risk Management"
                          dataKey="value"
                          stroke="#ef4444"
                          fill="#ef4444"
                          fillOpacity={0.2}
                          strokeWidth={3}
                        />
                        <Tooltip
                          formatter={(value: any) => [
                            `${value.toFixed(1)}`,
                            "Score",
                          ]}
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e2e8f0",
                            borderRadius: "12px",
                            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Enhanced Time Series Chart */}
            {timeSeriesData.length > 0 && (
              <Card className="border-0 shadow-xl bg-white">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <LineChartIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800">
                        Performance Timeline ({selectedPeriod})
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        Trading performance over selected period
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={450}>
                    <ComposedChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        stroke="#94a3b8"
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        stroke="#94a3b8"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        stroke="#94a3b8"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="trades"
                        fill="url(#gradient2)"
                        name="Trades"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="cumulativePnL"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        name="Cumulative P&L"
                        dot={{ fill: "#f59e0b", strokeWidth: 2, r: 5 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="winRate"
                        stroke="#10b981"
                        strokeWidth={3}
                        name="Win Rate %"
                        dot={{ fill: "#10b981", strokeWidth: 2, r: 5 }}
                      />
                      <defs>
                        <linearGradient
                          id="gradient2"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Enhanced Strategy Performance */}
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800">
                      Strategy Performance Analysis
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      Detailed breakdown of strategy effectiveness
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData.strategyPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="strategy"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      stroke="#94a3b8"
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      stroke="#94a3b8"
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        name === "totalPnL"
                          ? `₹${value.toFixed(2)}`
                          : name === "avgPnL"
                          ? `₹${value.toFixed(2)}`
                          : name === "winRate"
                          ? `${value.toFixed(1)}%`
                          : value,
                        name === "totalPnL"
                          ? "Total P&L"
                          : name === "avgPnL"
                          ? "Avg P&L"
                          : name === "winRate"
                          ? "Win Rate"
                          : "Trades",
                      ]}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="totalPnL"
                      fill="url(#gradient3)"
                      name="totalPnL"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="winRate"
                      fill="url(#gradient4)"
                      name="winRate"
                      radius={[4, 4, 0, 0]}
                    />
                    <defs>
                      <linearGradient
                        id="gradient3"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                      <linearGradient
                        id="gradient4"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Enhanced Risk-Reward Distribution */}
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800">
                      Risk-Reward Analysis
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      Distribution of risk vs reward across trades
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart data={chartData.riskDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="risk"
                      name="Risk"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      stroke="#94a3b8"
                    />
                    <YAxis
                      dataKey="reward"
                      name="Reward"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      stroke="#94a3b8"
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      formatter={(value: any, name: any) => [
                        `₹${value.toFixed(2)}`,
                        name === "risk" ? "Risk" : "Reward",
                      ]}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Scatter
                      dataKey="reward"
                      fill="#6366f1"
                      stroke="#4f46e5"
                      strokeWidth={2}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Patterns Tab - Enhanced with Premium Design */}
        {activeTab === "patterns" && (
          <div className="space-y-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-800">
                  Trading Patterns
                </h2>
                <p className="text-slate-600">
                  Discover patterns in your trading behavior
                </p>
              </div>
            </div>

            {patternData && (
              <>
                {/* Enhanced Win/Loss Streaks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50">
                    <CardContent className="p-8">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                          <Award className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-4xl font-bold text-green-600 mb-2">
                          {patternData.bestWinStreak}
                        </div>
                        <div className="text-lg font-semibold text-slate-700 mb-2">
                          Best Win Streak
                        </div>
                        <div className="text-sm text-slate-500">
                          Consecutive winning trades
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-xl bg-gradient-to-br from-red-50 to-pink-50">
                    <CardContent className="p-8">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                          <AlertTriangle className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-4xl font-bold text-red-600 mb-2">
                          {patternData.worstLossStreak}
                        </div>
                        <div className="text-lg font-semibold text-slate-700 mb-2">
                          Worst Loss Streak
                        </div>
                        <div className="text-sm text-slate-500">
                          Consecutive losing trades
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Enhanced Day of Week Performance */}
                <Card className="border-0 shadow-xl bg-white">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-slate-800">
                          Day of Week Performance
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                          How you perform on different days
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={prepareDayOfWeekData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          stroke="#94a3b8"
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          stroke="#94a3b8"
                        />
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            name === "totalPnL"
                              ? `₹${value.toFixed(2)}`
                              : name === "winRate"
                              ? `${value.toFixed(1)}%`
                              : value,
                            name === "totalPnL"
                              ? "P&L"
                              : name === "winRate"
                              ? "Win Rate"
                              : "Trades",
                          ]}
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e2e8f0",
                            borderRadius: "12px",
                            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="totalPnL"
                          fill="url(#gradient5)"
                          name="totalPnL"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="trades"
                          fill="url(#gradient6)"
                          name="trades"
                          radius={[4, 4, 0, 0]}
                        />
                        <defs>
                          <linearGradient
                            id="gradient5"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                          <linearGradient
                            id="gradient6"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Enhanced Instrument Performance */}
                <Card className="border-0 shadow-xl bg-white">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                        <Star className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-slate-800">
                          Top Performing Instruments
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                          Your best and worst performing instruments
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={prepareInstrumentData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="instrument"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          stroke="#94a3b8"
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          stroke="#94a3b8"
                        />
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            name === "totalPnL"
                              ? `₹${value.toFixed(2)}`
                              : name === "avgPnL"
                              ? `₹${value.toFixed(2)}`
                              : name === "winRate"
                              ? `${value.toFixed(1)}%`
                              : value,
                            name === "totalPnL"
                              ? "Total P&L"
                              : name === "avgPnL"
                              ? "Avg P&L"
                              : name === "winRate"
                              ? "Win Rate"
                              : "Trades",
                          ]}
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e2e8f0",
                            borderRadius: "12px",
                            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="totalPnL"
                          fill="url(#gradient7)"
                          name="totalPnL"
                          radius={[4, 4, 0, 0]}
                        />
                        <defs>
                          <linearGradient
                            id="gradient7"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#d97706" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* AI Insights Tab - Enhanced with Premium Design */}
        {activeTab === "insights" && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">
                    AI-Powered Insights
                  </h2>
                  <p className="text-slate-600">
                    Professional trading analysis and recommendations
                  </p>
                </div>
              </div>
              <Button
                onClick={generateAdvancedAnalytics}
                disabled={loading || entries.length === 0}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate New Insights
                  </>
                )}
              </Button>
            </div>

            {analytics ? (
              <div className="space-y-8">
                {/* Enhanced Executive Summary */}
                {analytics.executive_summary && (
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50">
                    <CardHeader className="pb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <Target className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-slate-800">
                            Executive Summary
                          </CardTitle>
                          <CardDescription className="text-slate-600">
                            Comprehensive performance overview
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="p-6 bg-white rounded-xl border border-blue-100 shadow-sm">
                        <h4 className="font-bold text-lg mb-3 text-slate-800">
                          Overall Performance
                        </h4>
                        <p className="text-slate-700 leading-relaxed">
                          {analytics.executive_summary.overall_performance}
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="p-6 bg-white rounded-xl border border-green-100 shadow-sm">
                          <h4 className="font-bold text-lg mb-4 text-green-700 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            Key Strengths
                          </h4>
                          <ul className="space-y-3">
                            {analytics.executive_summary.key_strengths?.map(
                              (strength: string, index: number) => (
                                <li
                                  key={index}
                                  className="flex items-start space-x-3"
                                >
                                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  </div>
                                  <span className="text-slate-700 leading-relaxed">
                                    {strength}
                                  </span>
                                </li>
                              )
                            )}
                          </ul>
                        </div>

                        <div className="p-6 bg-white rounded-xl border border-red-100 shadow-sm">
                          <h4 className="font-bold text-lg mb-4 text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Areas for Improvement
                          </h4>
                          <ul className="space-y-3">
                            {analytics.executive_summary.critical_weaknesses?.map(
                              (weakness: string, index: number) => (
                                <li
                                  key={index}
                                  className="flex items-start space-x-3"
                                >
                                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                  </div>
                                  <span className="text-slate-700 leading-relaxed">
                                    {weakness}
                                  </span>
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>

                      {analytics.executive_summary.trader_profile && (
                        <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                          <h4 className="font-bold text-lg mb-3 text-purple-700 flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Trader Profile
                          </h4>
                          <p className="text-slate-700 leading-relaxed">
                            {analytics.executive_summary.trader_profile}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Enhanced Performance Metrics */}
                {analytics.performance_metrics && (
                  <Card className="border-0 shadow-xl bg-white">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <BarChart3 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-slate-800">
                            Advanced Performance Metrics
                          </CardTitle>
                          <CardDescription className="text-slate-600">
                            Quantitative performance analysis
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {Object.entries(analytics.performance_metrics).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:shadow-lg transition-shadow duration-300"
                            >
                              <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                                {key.replace(/_/g, " ")}
                              </div>
                              <div className="text-2xl font-bold text-blue-700">
                                {String(value)}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Enhanced Risk Analysis */}
                {analytics.risk_analysis && (
                  <Card className="border-0 shadow-xl bg-white">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-slate-800">
                            Risk Analysis
                          </CardTitle>
                          <CardDescription className="text-slate-600">
                            Comprehensive risk assessment
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6">
                        {Object.entries(analytics.risk_analysis).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="p-6 border-l-4 border-red-400 bg-gradient-to-r from-red-50 to-pink-50 rounded-r-xl"
                            >
                              <h4 className="font-bold text-red-700 capitalize mb-3 text-lg">
                                {key.replace(/_/g, " ")}
                              </h4>
                              <p className="text-slate-700 leading-relaxed">
                                {String(value)}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Enhanced Strategy Analysis */}
                {analytics.strategy_analysis && (
                  <Card className="border-0 shadow-xl bg-white">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <Target className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-slate-800">
                            Strategy Analysis
                          </CardTitle>
                          <CardDescription className="text-slate-600">
                            Strategic insights and recommendations
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {Object.entries(analytics.strategy_analysis).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="p-6 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-100"
                            >
                              <h4 className="font-bold text-purple-700 capitalize mb-4 text-lg">
                                {key.replace(/_/g, " ")}
                              </h4>
                              {Array.isArray(value) ? (
                                <ul className="space-y-3">
                                  {value.map((item: string, index: number) => (
                                    <li
                                      key={index}
                                      className="flex items-start space-x-3"
                                    >
                                      <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                                      </div>
                                      <span className="text-slate-700 leading-relaxed">
                                        {item}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-slate-700 leading-relaxed">
                                  {String(value)}
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Enhanced Actionable Recommendations */}
                {analytics.actionable_recommendations && (
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <Zap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-slate-800">
                            Actionable Recommendations
                          </CardTitle>
                          <CardDescription className="text-slate-600">
                            Strategic action plan for improvement
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-8">
                        {Object.entries(
                          analytics.actionable_recommendations
                        ).map(([timeframe, recommendations]) => (
                          <div
                            key={timeframe}
                            className="p-6 bg-white rounded-xl border border-green-100 shadow-sm"
                          >
                            <h4 className="font-bold text-xl mb-4 capitalize text-green-700 flex items-center gap-2">
                              <Clock className="w-5 h-5" />
                              {timeframe.replace(/_/g, " ")}
                            </h4>
                            <ul className="space-y-4">
                              {Array.isArray(recommendations) ? (
                                recommendations.map(
                                  (rec: string, index: number) => (
                                    <li
                                      key={index}
                                      className="flex items-start space-x-4 p-4 bg-green-50 rounded-xl border border-green-100"
                                    >
                                      <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                                        {index + 1}
                                      </div>
                                      <span className="text-slate-700 leading-relaxed font-medium">
                                        {rec}
                                      </span>
                                    </li>
                                  )
                                )
                              ) : (
                                <li className="flex items-start space-x-4 p-4 bg-green-50 rounded-xl border border-green-100">
                                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                                  </div>
                                  <span className="text-slate-700 leading-relaxed font-medium">
                                    {String(recommendations)}
                                  </span>
                                </li>
                              )}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 to-pink-50">
                <CardContent className="p-16 text-center">
                  <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
                    <Brain className="w-12 h-12 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold mb-4 text-slate-800">
                    AI Insights Ready
                  </h3>
                  <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                    Generate comprehensive AI-powered analysis of your trading
                    performance, risk management, and personalized
                    recommendations tailored to your trading style.
                  </p>
                  <Button
                    onClick={generateAdvancedAnalytics}
                    disabled={loading || entries.length === 0}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-6 h-6 mr-3 animate-spin" />
                        Analyzing Your Trading Data...
                      </>
                    ) : entries.length === 0 ? (
                      <>
                        <Plus className="w-6 h-6 mr-3" />
                        Add Trades First
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-6 h-6 mr-3" />
                        Generate AI Insights
                      </>
                    )}
                  </Button>
                  {entries.length === 0 && (
                    <p className="text-sm text-slate-500 mt-4">
                      Add at least one trade to enable AI analysis
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Trades Tab - Enhanced with Premium Design */}
        {activeTab === "trades" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">
                    Trade Journal
                  </h2>
                  <p className="text-slate-600">
                    Manage and track your trading positions
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Select
                  value={filter}
                  onValueChange={(value: any) => setFilter(value)}
                >
                  <SelectTrigger className="w-40 h-12 border-2 border-slate-200 rounded-xl">
                    <SelectValue />
                    <SelectContent>
                      <SelectItem value="all">All Trades</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </SelectTrigger>
                </Select>

                <Select
                  value={strategyFilter}
                  onValueChange={setStrategyFilter}
                >
                  <SelectTrigger className="w-48 h-12 border-2 border-slate-200 rounded-xl">
                    <SelectValue placeholder="All Strategies" />
                    <SelectContent>
                      <SelectItem value="all">All Strategies</SelectItem>
                      {strategies.map((strategy) => (
                        <SelectItem key={strategy} value={strategy}>
                          {strategy}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectTrigger>
                </Select>

                <Button
                  onClick={() => {
                    setEditingEntry(null);
                    setShowForm(true);
                  }}
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg h-12"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Trade
                </Button>
              </div>
            </div>

            {/* Enhanced Trade Entry Form */}
            {showForm && (
              <Card className="border-0 shadow-2xl bg-white">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center">
                      {editingEntry ? (
                        <Edit className="w-5 h-5 text-white" />
                      ) : (
                        <Plus className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800">
                        {editingEntry ? "Edit Trade" : "Add New Trade"}
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        {editingEntry
                          ? "Update the trade details below"
                          : "Enter the details of your trade"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-3">
                        <Label
                          htmlFor="broker"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Broker
                        </Label>
                        <Input
                          id="broker"
                          value={formData.broker}
                          onChange={(e) =>
                            setFormData({ ...formData, broker: e.target.value })
                          }
                          placeholder="e.g., Zerodha, Angel One"
                          className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="market"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Market
                        </Label>
                        <Select
                          value={formData.market}
                          onValueChange={(value) =>
                            setFormData({ ...formData, market: value })
                          }
                        >
                          <SelectTrigger className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500">
                            <SelectValue placeholder="Select Market" />
                            <SelectContent>
                              <SelectItem value="NSE">NSE</SelectItem>
                              <SelectItem value="BSE">BSE</SelectItem>
                              <SelectItem value="MCX">MCX</SelectItem>
                              <SelectItem value="NCDEX">NCDEX</SelectItem>
                              <SelectItem value="NFO">NFO</SelectItem>
                              <SelectItem value="CDS">CDS</SelectItem>
                            </SelectContent>
                          </SelectTrigger>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="instrument"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Instrument
                        </Label>
                        <Input
                          id="instrument"
                          value={formData.instrument}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              instrument: e.target.value,
                            })
                          }
                          placeholder="e.g., RELIANCE, BANKNIFTY"
                          className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="direction"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Direction
                        </Label>
                        <Select
                          value={formData.direction}
                          onValueChange={(value: any) =>
                            setFormData({ ...formData, direction: value })
                          }
                        >
                          <SelectTrigger className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500">
                            <SelectValue />
                            <SelectContent>
                              <SelectItem value="buy">
                                <div className="flex items-center gap-2">
                                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                                  Buy
                                </div>
                              </SelectItem>
                              <SelectItem value="sell">
                                <div className="flex items-center gap-2">
                                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                                  Sell
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </SelectTrigger>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="qty"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Quantity
                        </Label>
                        <Input
                          id="qty"
                          type="number"
                          value={formData.qty}
                          onChange={(e) =>
                            setFormData({ ...formData, qty: e.target.value })
                          }
                          placeholder="Number of shares/lots"
                          className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="entry_price"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Entry Price
                        </Label>
                        <Input
                          id="entry_price"
                          type="number"
                          step="0.01"
                          value={formData.entry_price}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              entry_price: e.target.value,
                            })
                          }
                          placeholder="Entry price"
                          className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="exit_price"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Exit Price (Optional)
                        </Label>
                        <Input
                          id="exit_price"
                          type="number"
                          step="0.01"
                          value={formData.exit_price}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              exit_price: e.target.value,
                            })
                          }
                          placeholder="Exit price"
                          className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="entry_dt"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Entry Date & Time
                        </Label>
                        <Input
                          id="entry_dt"
                          type="datetime-local"
                          value={formData.entry_dt}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              entry_dt: e.target.value,
                            })
                          }
                          className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="exit_dt"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Exit Date & Time (Optional)
                        </Label>
                        <Input
                          id="exit_dt"
                          type="datetime-local"
                          value={formData.exit_dt}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              exit_dt: e.target.value,
                            })
                          }
                          className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="stoploss"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Stop Loss
                        </Label>
                        <Input
                          id="stoploss"
                          type="number"
                          step="0.01"
                          value={formData.stoploss}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              stoploss: e.target.value,
                            })
                          }
                          placeholder="Stop loss price"
                          className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="commission"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Commission
                        </Label>
                        <Input
                          id="commission"
                          type="number"
                          step="0.01"
                          value={formData.commission}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              commission: e.target.value,
                            })
                          }
                          placeholder="Brokerage + charges"
                          className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="strategy"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Strategy (Optional)
                        </Label>
                        <Input
                          id="strategy"
                          value={formData.strategy}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              strategy: e.target.value,
                            })
                          }
                          placeholder="e.g., scalping, swing"
                          className="h-12 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label
                          htmlFor="setup"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Setup Description
                        </Label>
                        <Textarea
                          id="setup"
                          value={formData.setup}
                          onChange={(e) =>
                            setFormData({ ...formData, setup: e.target.value })
                          }
                          placeholder="Describe your trade setup..."
                          className="min-h-24 border-2 border-slate-200 rounded-xl focus:border-indigo-500 resize-none"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="reason"
                          className="text-sm font-semibold text-slate-700"
                        >
                          Reason/Notes
                        </Label>
                        <Textarea
                          id="reason"
                          value={formData.reason}
                          onChange={(e) =>
                            setFormData({ ...formData, reason: e.target.value })
                          }
                          placeholder="Why did you take this trade?"
                          className="min-h-24 border-2 border-slate-200 rounded-xl focus:border-indigo-500 resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-slate-200">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg"
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : editingEntry ? (
                          <>
                            <Edit className="w-5 h-5 mr-2" />
                            Update Trade
                          </>
                        ) : (
                          <>
                            <Plus className="w-5 h-5 mr-2" />
                            Save Trade
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetForm}
                        className="border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 px-8 py-3 rounded-xl font-semibold"
                      >
                        <XCircle className="w-5 h-5 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Enhanced Trades Table */}
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-slate-500 to-gray-600 rounded-xl flex items-center justify-center">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800">
                        Trade History ({filteredEntries.length}
                        {filter !== "all" ? ` ${filter}` : ""} trades)
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        Complete record of your trading activity
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-500 font-medium">
                      {filteredEntries.length} of {entries.length} trades
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left p-4 font-bold text-slate-700">
                          Date
                        </th>
                        <th className="text-left p-4 font-bold text-slate-700">
                          Instrument
                        </th>
                        <th className="text-left p-4 font-bold text-slate-700">
                          Direction
                        </th>
                        <th className="text-left p-4 font-bold text-slate-700">
                          Qty
                        </th>
                        <th className="text-left p-4 font-bold text-slate-700">
                          Entry
                        </th>
                        <th className="text-left p-4 font-bold text-slate-700">
                          Exit
                        </th>
                        <th className="text-left p-4 font-bold text-slate-700">
                          P&L
                        </th>
                        <th className="text-left p-4 font-bold text-slate-700">
                          Status
                        </th>
                        <th className="text-left p-4 font-bold text-slate-700">
                          Strategy
                        </th>
                        <th className="text-left p-4 font-bold text-slate-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => (
                        <tr
                          key={entry.s_no}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-200"
                        >
                          <td className="p-4 text-sm font-medium text-slate-700">
                            {new Date(entry.entry_dt).toLocaleDateString()}
                          </td>
                          <td className="p-4 font-semibold text-slate-800">
                            {entry.instrument}
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                entry.direction === "buy"
                                  ? "bg-green-100 text-green-800 border border-green-200"
                                  : "bg-red-100 text-red-800 border border-red-200"
                              }`}
                            >
                              {entry.direction === "buy" ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {entry.direction.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-slate-700">
                            {entry.qty}
                          </td>
                          <td className="p-4 font-mono font-medium text-slate-700">
                            ₹{entry.entry_price.toFixed(2)}
                          </td>
                          <td className="p-4 font-mono font-medium text-slate-700">
                            {entry.exit_price
                              ? `₹${entry.exit_price.toFixed(2)}`
                              : "-"}
                          </td>
                          <td className="p-4">
                            {entry.p_and_l !== undefined ? (
                              <span
                                className={`font-bold font-mono ${
                                  entry.p_and_l >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                ₹{entry.p_and_l.toFixed(2)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                entry.status === "open"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-blue-100 text-blue-800 border border-blue-200"
                              }`}
                            >
                              {entry.status === "open" ? (
                                <Unlock className="w-3 h-3" />
                              ) : (
                                <Lock className="w-3 h-3" />
                              )}
                              {entry.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 text-sm font-medium text-slate-600">
                            {entry.strategy}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(entry)}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(entry.s_no)}
                                className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredEntries.length === 0 && (
                    <div className="text-center py-16 text-slate-500">
                      <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        {filter === "all"
                          ? "No trades found"
                          : `No ${filter} trades found`}
                      </h3>
                      <p className="text-slate-400">
                        {filter === "all"
                          ? "Add your first trade to get started with professional analytics!"
                          : `Try adjusting your filters or add some ${filter} trades.`}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default TradingJournalApp;
