const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const Joi = require("joi");
const math = require("mathjs");
const ss = require("simple-statistics");
const validator = require("validator");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase configuration (REQUIRED) - Temporary hardcoded for testing
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Replace with your actual key
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Replace with your actual key

// Validate required environment variables
if (
  !supabaseUrl ||
  !supabaseServiceKey ||
  !supabaseAnonKey ||
  supabaseUrl === "your_actual_supabase_url_here" ||
  supabaseServiceKey === "your_actual_service_role_key_here"
) {
  console.error("❌ FATAL ERROR: Supabase configuration is required!");
  console.error("");
  console.error("Please configure the following environment variables:");
  console.error("  SUPABASE_URL=your_supabase_project_url");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key");
  console.error("  SUPABASE_ANON_KEY=your_anon_key");
  console.error("");
  console.error(
    "Get these values from: https://app.supabase.com/project/YOUR_PROJECT/settings/api"
  );
  process.exit(1);
}

// Initialize Supabase clients
let supabaseAdmin = null;
let supabase = null;

try {
  const { createClient } = require("@supabase/supabase-js");
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log("✅ Supabase clients initialized successfully");
} catch (error) {
  console.error(
    "❌ FATAL ERROR: Failed to initialize Supabase:",
    error.message
  );
  process.exit(1);
}

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || "db.fsicauceosmdrhxmvreu.supabase.co",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "3146",
  database: process.env.DB_NAME || "postgres",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: false,
});

// Test database connection
pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("PostgreSQL connection error:", err);
});

// Validation schemas
const userProfileSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .optional(),
  tradingExperience: Joi.string()
    .valid("beginner", "intermediate", "advanced", "professional")
    .optional(),
  preferredMarket: Joi.string().optional(),
  riskTolerance: Joi.string().valid("low", "medium", "high").optional(),
});

const tradeSchema = Joi.object({
  gmail: Joi.string().optional(),
  status: Joi.string().valid("open", "closed").required(),
  broker: Joi.string().required(),
  market: Joi.string().required(),
  instrument: Joi.string().required(),
  direction: Joi.string().valid("buy", "sell").required(),
  qty: Joi.number().positive().required(),
  entry_price: Joi.number().positive().required(),
  exit_price: Joi.number().positive().optional(),
  entry_dt: Joi.date().iso().required(),
  exit_dt: Joi.date().iso().optional(),
  stoploss: Joi.number().positive().required(),
  commission: Joi.number().min(0).required(),
  p_and_l: Joi.number().optional(),
  strategy: Joi.string().required(),
  setup: Joi.string().optional(),
  reason: Joi.string().optional(),
});

// Supabase Authentication middleware (REQUIRED)
const authenticateSupabaseUser = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Authorization header is missing",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Bearer token is missing",
      });
    }

    // Verify the JWT token with Supabase
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      console.error("Token verification error:", error);
      return res.status(403).json({
        error: "Authentication failed",
        message: "Invalid or expired token",
      });
    }

    if (!user) {
      return res.status(403).json({
        error: "Authentication failed",
        message: "User not found",
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      ...user.user_metadata,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({
      error: "Authentication service error",
      message: "Failed to verify authentication",
    });
  }
};

// Database initialization
const initializeDatabase = async () => {
  try {
    console.log("Initializing database schema with Supabase auth...");

    // User profiles table (references Supabase auth.users)
    const createUserProfilesTableQuery = `
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        phone VARCHAR(15),
        trading_experience VARCHAR(20) CHECK (trading_experience IN ('beginner', 'intermediate', 'advanced', 'professional')) DEFAULT 'beginner',
        preferred_market VARCHAR(100),
        risk_tolerance VARCHAR(10) CHECK (risk_tolerance IN ('low', 'medium', 'high')) DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createUserProfilesTableQuery);
    console.log("✅ User profiles table created/verified");

    // Create indexes for user_profiles table
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);"
    );
    console.log("✅ User profiles indexes created");

    // Trading journal table (references Supabase auth.users)
    const createTradingTableQuery = `
      CREATE TABLE IF NOT EXISTS trading_journal (
        s_no SERIAL PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        status VARCHAR(10) CHECK (status IN ('open', 'closed')) NOT NULL,
        broker VARCHAR(100) NOT NULL,
        market VARCHAR(100) NOT NULL,
        instrument VARCHAR(100) NOT NULL,
        direction VARCHAR(10) CHECK (direction IN ('buy', 'sell')) NOT NULL,
        qty DECIMAL(15,4) NOT NULL,
        entry_price DECIMAL(15,4) NOT NULL,
        exit_price DECIMAL(15,4),
        entry_dt TIMESTAMP NOT NULL,
        exit_dt TIMESTAMP,
        stoploss DECIMAL(15,4) NOT NULL,
        commission DECIMAL(15,4) NOT NULL,
        p_and_l DECIMAL(15,4),
        strategy VARCHAR(100) NOT NULL,
        setup TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTradingTableQuery);
    console.log("✅ Trading journal table created/verified");

    // Create indexes for trading_journal table
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_trading_journal_user_id ON trading_journal(user_id);"
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_trading_journal_status ON trading_journal(status);"
    );
    console.log("✅ Trading journal indexes created");

    // Enable Row Level Security
    const enableRLSQuery = `
      ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE trading_journal ENABLE ROW LEVEL SECURITY;
    `;

    await pool.query(enableRLSQuery);
    console.log("✅ Row Level Security enabled");

    // Create RLS policies
    const rlsPoliciesQuery = `
      -- User profiles policies
      DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
      DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
      DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

      CREATE POLICY "Users can view own profile" ON user_profiles
        FOR SELECT USING (auth.uid() = user_id);

      CREATE POLICY "Users can update own profile" ON user_profiles
        FOR UPDATE USING (auth.uid() = user_id);

      CREATE POLICY "Users can insert own profile" ON user_profiles
        FOR INSERT WITH CHECK (auth.uid() = user_id);

      -- Trading journal policies
      DROP POLICY IF EXISTS "Users can view own trades" ON trading_journal;
      DROP POLICY IF EXISTS "Users can insert own trades" ON trading_journal;
      DROP POLICY IF EXISTS "Users can update own trades" ON trading_journal;
      DROP POLICY IF EXISTS "Users can delete own trades" ON trading_journal;

      CREATE POLICY "Users can view own trades" ON trading_journal
        FOR SELECT USING (auth.uid() = user_id);

      CREATE POLICY "Users can insert own trades" ON trading_journal
        FOR INSERT WITH CHECK (auth.uid() = user_id);

      CREATE POLICY "Users can update own trades" ON trading_journal
        FOR UPDATE USING (auth.uid() = user_id);

      CREATE POLICY "Users can delete own trades" ON trading_journal
        FOR DELETE USING (auth.uid() = user_id);
    `;

    await pool.query(rlsPoliciesQuery);
    console.log("✅ RLS policies created");

    console.log("✅ Database initialization completed successfully");
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    throw error;
  }
};

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Trading Journal API is running with Supabase Auth!",
    authMode: "Supabase Authentication",
    timestamp: new Date().toISOString(),
  });
});

// Database status check
app.get("/api/db-status", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as current_time");
    res.json({
      connected: true,
      message: "Database connected successfully",
      authMode: "Supabase Authentication",
      timestamp: new Date().toISOString(),
      db_time: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database status check failed:", error);
    res.status(500).json({
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get/Create user profile
app.get("/api/auth/profile", authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // First try to get existing profile
    const profileQuery = `
      SELECT user_id, phone, trading_experience, preferred_market, risk_tolerance, created_at, updated_at
      FROM user_profiles 
      WHERE user_id = $1
    `;

    let result = await pool.query(profileQuery, [userId]);

    // If no profile exists, create one
    if (result.rows.length === 0) {
      const createProfileQuery = `
        INSERT INTO user_profiles (user_id)
        VALUES ($1)
        RETURNING user_id, phone, trading_experience, preferred_market, risk_tolerance, created_at, updated_at
      `;

      result = await pool.query(createProfileQuery, [userId]);
    }

    const profile = result.rows[0];

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        phone: profile.phone,
        tradingExperience: profile.trading_experience,
        preferredMarket: profile.preferred_market,
        riskTolerance: profile.risk_tolerance,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      error: "Failed to fetch profile",
      message: error.message,
    });
  }
});

// Update user profile
app.put("/api/auth/profile", authenticateSupabaseUser, async (req, res) => {
  try {
    const { error, value } = userProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation Error",
        details: error.details.map((detail) => detail.message),
      });
    }

    const userId = req.user.id;
    const { phone, tradingExperience, preferredMarket, riskTolerance } = value;

    const updateQuery = `
      UPDATE user_profiles 
      SET phone = COALESCE($2, phone),
          trading_experience = COALESCE($3, trading_experience),
          preferred_market = COALESCE($4, preferred_market),
          risk_tolerance = COALESCE($5, risk_tolerance),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      userId,
      phone,
      tradingExperience,
      preferredMarket,
      riskTolerance,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profile = result.rows[0];

    res.json({
      message: "Profile updated successfully",
      user: {
        id: req.user.id,
        email: req.user.email,
        phone: profile.phone,
        tradingExperience: profile.trading_experience,
        preferredMarket: profile.preferred_market,
        riskTolerance: profile.risk_tolerance,
        updatedAt: profile.updated_at,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      error: "Failed to update profile",
      message: error.message,
    });
  }
});

// Get trades
app.get("/api/trades", authenticateSupabaseUser, async (req, res) => {
  try {
    const { status, strategy, limit = 1000 } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT s_no, status, broker, market, instrument, direction, 
             qty, entry_price, exit_price, entry_dt, exit_dt, stoploss, 
             commission, p_and_l, strategy, setup, reason, created_at, updated_at
      FROM trading_journal 
      WHERE user_id = $1
    `;
    const values = [userId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(status);
    }

    if (strategy) {
      paramCount++;
      query += ` AND strategy = $${paramCount}`;
      values.push(strategy);
    }

    query += ` ORDER BY s_no DESC LIMIT $${paramCount + 1}`;
    values.push(limit);

    const result = await pool.query(query, values);

    const trades = result.rows.map((row) => ({
      ...row,
      qty: parseFloat(row.qty),
      entry_price: parseFloat(row.entry_price),
      exit_price: row.exit_price ? parseFloat(row.exit_price) : null,
      stoploss: parseFloat(row.stoploss),
      commission: parseFloat(row.commission),
      p_and_l: row.p_and_l ? parseFloat(row.p_and_l) : null,
    }));

    res.json({
      trades,
      count: trades.length,
    });
  } catch (error) {
    console.error("Error fetching trades:", error);
    res.status(500).json({
      error: "Failed to fetch trades",
      message: error.message,
    });
  }
});

// Add new trade
app.post("/api/trades", authenticateSupabaseUser, async (req, res) => {
  try {
    const { error, value } = tradeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation Error",
        details: error.details.map((detail) => detail.message),
      });
    }

    const gmail = req.user.email;

    const {
      status,
      broker,
      market,
      instrument,
      direction,
      qty,
      entry_price,
      exit_price,
      entry_dt,
      exit_dt,
      stoploss,
      commission,
      p_and_l,
      strategy,
      setup,
      reason,
    } = value;

    const userId = req.user.id;

    console.log({ userId });

    const query = `
  INSERT INTO trading_journal (
    user_id, status, broker, market, instrument, direction, qty, 
    entry_price, exit_price, entry_dt, exit_dt, stoploss, 
    commission, p_and_l, strategy, setup, reason, gmail
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
  RETURNING *
`;

    const values = [
      userId,
      status,
      broker,
      market,
      instrument,
      direction,
      qty,
      entry_price,
      exit_price || null,
      entry_dt,
      exit_dt || null,
      stoploss,
      commission,
      p_and_l || null,
      strategy,
      setup || null,
      reason || null,
      gmail,
    ];

    const result = await pool.query(query, values);
    const savedTrade = {
      ...result.rows[0],
      qty: parseFloat(result.rows[0].qty),
      entry_price: parseFloat(result.rows[0].entry_price),
      exit_price: result.rows[0].exit_price
        ? parseFloat(result.rows[0].exit_price)
        : null,
      stoploss: parseFloat(result.rows[0].stoploss),
      commission: parseFloat(result.rows[0].commission),
      p_and_l: result.rows[0].p_and_l
        ? parseFloat(result.rows[0].p_and_l)
        : null,
    };

    res.status(201).json({
      message: "Trade created successfully",
      trade: savedTrade,
    });
  } catch (error) {
    console.error("Error creating trade:", error);
    res.status(500).json({
      error: "Failed to create trade",
      message: error.message,
    });
  }
});

// Update trade
app.put("/api/trades/:id", authenticateSupabaseUser, async (req, res) => {
  try {
    const tradeId = req.params.id;
    const userId = req.user.id;

    const { error, value } = tradeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation Error",
        details: error.details.map((detail) => detail.message),
      });
    }

    const {
      status,
      broker,
      market,
      instrument,
      direction,
      qty,
      entry_price,
      exit_price,
      entry_dt,
      exit_dt,
      stoploss,
      commission,
      p_and_l,
      strategy,
      setup,
      reason,
    } = value;

    const query = `
      UPDATE trading_journal 
      SET status = $2, broker = $3, market = $4, instrument = $5, direction = $6, 
          qty = $7, entry_price = $8, exit_price = $9, entry_dt = $10, exit_dt = $11, 
          stoploss = $12, commission = $13, p_and_l = $14, strategy = $15, 
          setup = $16, reason = $17, updated_at = CURRENT_TIMESTAMP
      WHERE s_no = $1 AND user_id = $18
      RETURNING *
    `;

    const values = [
      tradeId,
      status,
      broker,
      market,
      instrument,
      direction,
      qty,
      entry_price,
      exit_price || null,
      entry_dt,
      exit_dt || null,
      stoploss,
      commission,
      p_and_l || null,
      strategy,
      setup || null,
      reason || null,
      userId,
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Trade not found or unauthorized" });
    }

    const updatedTrade = {
      ...result.rows[0],
      qty: parseFloat(result.rows[0].qty),
      entry_price: parseFloat(result.rows[0].entry_price),
      exit_price: result.rows[0].exit_price
        ? parseFloat(result.rows[0].exit_price)
        : null,
      stoploss: parseFloat(result.rows[0].stoploss),
      commission: parseFloat(result.rows[0].commission),
      p_and_l: result.rows[0].p_and_l
        ? parseFloat(result.rows[0].p_and_l)
        : null,
    };

    res.json({
      message: "Trade updated successfully",
      trade: updatedTrade,
    });
  } catch (error) {
    console.error("Error updating trade:", error);
    res.status(500).json({
      error: "Failed to update trade",
      message: error.message,
    });
  }
});

// Delete trade
app.delete("/api/trades/:id", authenticateSupabaseUser, async (req, res) => {
  try {
    const tradeId = req.params.id;
    const userId = req.user.id;

    const query =
      "DELETE FROM trading_journal WHERE s_no = $1 AND user_id = $2 RETURNING s_no";
    const result = await pool.query(query, [tradeId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Trade not found or unauthorized" });
    }

    res.json({
      message: "Trade deleted successfully",
      tradeId: result.rows[0].s_no,
    });
  } catch (error) {
    console.error("Error deleting trade:", error);
    res.status(500).json({
      error: "Failed to delete trade",
      message: error.message,
    });
  }
});

// Get trading statistics
app.get("/api/analytics/stats", authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_trades,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_trades,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_trades,
        COALESCE(SUM(p_and_l), 0) as total_pnl,
        COALESCE(AVG(p_and_l), 0) as avg_pnl,
        COUNT(CASE WHEN p_and_l > 0 THEN 1 END) as winning_trades,
        COUNT(CASE WHEN p_and_l < 0 THEN 1 END) as losing_trades,
        COALESCE(MAX(p_and_l), 0) as best_trade,
        COALESCE(MIN(p_and_l), 0) as worst_trade
      FROM trading_journal 
      WHERE user_id = $1
    `;

    const result = await pool.query(statsQuery, [userId]);
    const stats = result.rows[0];

    const winRate =
      stats.closed_trades > 0
        ? ((stats.winning_trades / stats.closed_trades) * 100).toFixed(2)
        : 0;

    res.json({
      total_trades: parseInt(stats.total_trades),
      open_trades: parseInt(stats.open_trades),
      closed_trades: parseInt(stats.closed_trades),
      winning_trades: parseInt(stats.winning_trades),
      losing_trades: parseInt(stats.losing_trades),
      total_pnl: parseFloat(stats.total_pnl),
      avg_pnl: parseFloat(stats.avg_pnl),
      best_trade: parseFloat(stats.best_trade),
      worst_trade: parseFloat(stats.worst_trade),
      win_rate: parseFloat(winRate),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      error: "Failed to fetch statistics",
      message: error.message,
    });
  }
});

// Supabase webhook endpoint for user creation
app.post("/api/webhooks/supabase", async (req, res) => {
  try {
    const { type, record } = req.body;

    if (type === "INSERT" && record.email) {
      // Create user profile when a new user signs up via Supabase Auth
      const createProfileQuery = `
        INSERT INTO user_profiles (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `;

      await pool.query(createProfileQuery, [record.id]);
      console.log(`Created profile for user: ${record.email}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong!",
  });
});

// Start server
const startServer = async () => {
  try {
    console.log("Testing database connection...");
    await pool.query("SELECT 1");
    console.log("✅ Database connection successful");

    console.log("Testing Supabase connection...");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    console.log("✅ Supabase connection successful");

    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on: http://localhost:${PORT}`);
      console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
      console.log(`💾 DB status: http://localhost:${PORT}/api/db-status`);
      console.log("✅ Server ready with Supabase authentication!");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    console.error(
      "Please ensure your Supabase configuration is correct and try again."
    );
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await pool.end();
  process.exit(0);
});

startServer();
