const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Joi = require('joi');
const math = require('mathjs');
const ss = require('simple-statistics');
const validator = require('validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase configuration (REQUIRED) - Temporary hardcoded for testing
const supabaseUrl = 'https://fsicauceosmdrhxmvreu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzaWNhdWNlb3NtZHJoeG12cmV1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODEwMjk5OSwiZXhwIjoyMDczNjc4OTk5fQ.bqzxqGvx_l8-PQ4Ms5fgorweqQCn8fWaBF1O8fs8lX0';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzaWNhdWNlb3NtZHJoeG12cmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMDI5OTksImV4cCI6MjA3MzY3ODk5OX0.J_Dx9SLkzffTFcDhxMix56cmtpM4710nqafnyP5BLhk';

// Validate required environment variables
if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey ||
    supabaseUrl === 'your_actual_supabase_url_here' || 
    supabaseServiceKey === 'your_actual_service_role_key_here') {
  console.error('❌ FATAL ERROR: Supabase configuration is required!');
  console.error('');
  console.error('Please configure the following environment variables:');
  console.error('  SUPABASE_URL=your_supabase_project_url');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  console.error('  SUPABASE_ANON_KEY=your_anon_key');
  console.error('');
  console.error('Get these values from: https://app.supabase.com/project/YOUR_PROJECT/settings/api');
  process.exit(1);
}

// Initialize Supabase clients
let supabaseAdmin = null;
let supabase = null;
let createClient = null;

try {
  const supabaseJs = require('@supabase/supabase-js');
  createClient = supabaseJs.createClient;
  
  // Admin client (bypasses RLS, for admin operations)
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  });
  
  // Regular client (respects RLS, for user operations)
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: {
      schema: 'public'
    }
  });
  
  console.log('✅ Supabase clients initialized successfully');
} catch (error) {
  console.error('❌ FATAL ERROR: Failed to initialize Supabase:', error.message);
  process.exit(1);
}

// PostgreSQL connection pool for direct database operations
const pool = new Pool({
  host: process.env.DB_HOST || 'db.fsicauceosmdrhxmvreu.supabase.co',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '3146',
  database: process.env.DB_NAME || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Validation schemas
const userProfileSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  tradingExperience: Joi.string().valid('beginner', 'intermediate', 'advanced', 'professional').optional(),
  preferredMarket: Joi.string().optional(),
  riskTolerance: Joi.string().valid('low', 'medium', 'high').optional()
});

const tradeSchema = Joi.object({
  status: Joi.string().valid('open', 'closed').required(),
  broker: Joi.string().required(),
  market: Joi.string().required(),
  instrument: Joi.string().required(),
  direction: Joi.string().valid('buy', 'sell').required(),
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
  reason: Joi.string().optional()
});

// Helper function to safely convert values to numbers
const safeParseFloat = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

// Helper function to format trade data - converts string decimals to numbers
const formatTradeData = (trade) => {
  if (!trade) return null;
  
  return {
    ...trade,
    // Convert string decimals to numbers for frontend
    s_no: parseInt(trade.s_no) || trade.s_no,
    qty: safeParseFloat(trade.qty),
    entry_price: safeParseFloat(trade.entry_price),
    exit_price: safeParseFloat(trade.exit_price),
    stoploss: safeParseFloat(trade.stoploss),
    commission: safeParseFloat(trade.commission),
    p_and_l: safeParseFloat(trade.p_and_l),
    // Ensure dates are strings
    entry_dt: trade.entry_dt,
    exit_dt: trade.exit_dt,
    created_at: trade.created_at,
    updated_at: trade.updated_at
  };
};

// Helper function to format multiple trades
const formatTradesData = (trades) => {
  if (!trades || !Array.isArray(trades)) return [];
  return trades.map(formatTradeData);
};

// Supabase Authentication middleware
const authenticateSupabaseUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Authorization header is missing' 
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Bearer token is missing' 
      });
    }

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      console.error('Token verification error:', error);
      return res.status(403).json({ 
        error: 'Authentication failed',
        message: 'Invalid or expired token' 
      });
    }

    if (!user) {
      return res.status(403).json({ 
        error: 'Authentication failed',
        message: 'User not found' 
      });
    }

    // Create a user-specific Supabase client with RLS context
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      db: {
        schema: 'public'
      }
    });

    // Attach user and client to request object
    req.user = {
      id: user.id,
      email: user.email,
      ...user.user_metadata
    };
    req.supabase = userSupabase;

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication service error',
      message: 'Failed to verify authentication' 
    });
  }
};

// Enhanced schema fixing function
const fixDatabaseSchema = async () => {
  try {
    console.log('🔧 Checking and fixing database schema...');
    
    // Get ALL columns from existing trading_journal table
    const allColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'trading_journal'
      ORDER BY ordinal_position;
    `);

    if (allColumns.rows.length > 0) {
      console.log('📋 Current table structure:');
      allColumns.rows.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });

      // Check if there are unexpected columns
      const expectedColumns = [
        's_no', 'user_id', 'status', 'broker', 'market', 'instrument', 'direction',
        'qty', 'entry_price', 'exit_price', 'entry_dt', 'exit_dt', 'stoploss',
        'commission', 'p_and_l', 'strategy', 'setup', 'reason', 'created_at', 'updated_at'
      ];

      const actualColumns = allColumns.rows.map(row => row.column_name);
      const unexpectedColumns = actualColumns.filter(col => !expectedColumns.includes(col));
      
      if (unexpectedColumns.length > 0) {
        console.log('⚠️ Found unexpected columns:', unexpectedColumns);
        console.log('🔄 Recreating table with correct schema...');
        
        // Drop and recreate with correct schema
        await pool.query('DROP TABLE IF EXISTS trading_journal CASCADE;');
        console.log('✅ Dropped existing trading_journal table');
        
        // Create with our expected schema
        await pool.query(`
          CREATE TABLE trading_journal (
            s_no SERIAL PRIMARY KEY,
            user_id UUID NOT NULL,
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
        `);
        console.log('✅ Recreated trading_journal with correct schema');
      } else {
        // Check if user_id is UUID type
        const userIdColumn = allColumns.rows.find(col => col.column_name === 'user_id');
        if (userIdColumn && userIdColumn.data_type !== 'uuid') {
          console.log(`⚠️ user_id column is ${userIdColumn.data_type}, should be uuid. Fixing...`);
          
          await pool.query('DROP TABLE IF EXISTS trading_journal CASCADE;');
          await pool.query(`
            CREATE TABLE trading_journal (
              s_no SERIAL PRIMARY KEY,
              user_id UUID NOT NULL,
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
          `);
          console.log('✅ Fixed user_id column type to UUID');
        } else {
          console.log('✅ Schema is correct');
        }
      }
    }

    // Final verification
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'trading_journal'
      ORDER BY ordinal_position;
    `);
    
    console.log('✅ Final schema verification:');
    verifyResult.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ Error fixing schema:', error);
    throw error;
  }
};

// Database initialization with enhanced schema validation
const initializeDatabase = async () => {
  try {
    console.log('Initializing database schema with Supabase auth and RLS...');

    // Test PostgreSQL connection first
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connection verified');

    // Fix schema issues first
    await fixDatabaseSchema();

    // Create user_profiles table
    const userProfilesTable = `
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id UUID PRIMARY KEY,
        phone VARCHAR(15),
        trading_experience VARCHAR(20) CHECK (trading_experience IN ('beginner', 'intermediate', 'advanced', 'professional')) DEFAULT 'beginner',
        preferred_market VARCHAR(100),
        risk_tolerance VARCHAR(10) CHECK (risk_tolerance IN ('low', 'medium', 'high')) DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(userProfilesTable);
    console.log('✅ User profiles table created/verified');

    // Ensure trading_journal table exists with correct schema
    const tradingJournalTable = `
      CREATE TABLE IF NOT EXISTS trading_journal (
        s_no SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
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

    await pool.query(tradingJournalTable);
    console.log('✅ Trading journal table created/verified');

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trading_journal_user_id ON trading_journal(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trading_journal_status ON trading_journal(status);');
    console.log('✅ Database indexes created');

    // Enable Row Level Security
    try {
      await pool.query('ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;');
      await pool.query('ALTER TABLE trading_journal ENABLE ROW LEVEL SECURITY;');
      console.log('✅ Row Level Security enabled');
    } catch (rlsError) {
      console.log('ℹ️ RLS already enabled or not supported');
    }

    // Create RLS policies
    try {
      // User profiles policies
      await pool.query('DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;');
      await pool.query('DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;');
      await pool.query('DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;');

      await pool.query(`CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);`);
      await pool.query(`CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);`);
      await pool.query(`CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);`);

      // Trading journal policies
      await pool.query('DROP POLICY IF EXISTS "Users can view own trades" ON trading_journal;');
      await pool.query('DROP POLICY IF EXISTS "Users can insert own trades" ON trading_journal;');
      await pool.query('DROP POLICY IF EXISTS "Users can update own trades" ON trading_journal;');
      await pool.query('DROP POLICY IF EXISTS "Users can delete own trades" ON trading_journal;');

      await pool.query(`CREATE POLICY "Users can view own trades" ON trading_journal FOR SELECT USING (auth.uid() = user_id);`);
      await pool.query(`CREATE POLICY "Users can insert own trades" ON trading_journal FOR INSERT WITH CHECK (auth.uid() = user_id);`);
      await pool.query(`CREATE POLICY "Users can update own trades" ON trading_journal FOR UPDATE USING (auth.uid() = user_id);`);
      await pool.query(`CREATE POLICY "Users can delete own trades" ON trading_journal FOR DELETE USING (auth.uid() = user_id);`);
      
      console.log('✅ RLS policies created successfully');
    } catch (policyError) {
      console.log('⚠️ RLS policies could not be created - using middleware-only security');
      console.log('   This is normal if auth.uid() function is not available');
      console.log('   Security will be enforced through authentication middleware');
    }

    console.log('✅ Database initialization completed successfully');
    console.log('🔒 Security: Authentication Middleware + RLS (where supported)');
    console.log('ℹ️ Note: Supabase API queries will use PostgreSQL fallback due to schema configuration');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Trading Journal API is running with Supabase Auth + RLS!',
    authMode: 'Supabase Authentication + Row Level Security',
    timestamp: new Date().toISOString()
  });
});

// Database status check
app.get('/api/db-status', async (req, res) => {
  try {
    // Test PostgreSQL connection
    const pgResult = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    
    // Test Supabase connection
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });

    res.json({ 
      connected: true, 
      message: 'Database connected successfully',
      authMode: 'Supabase Authentication + Row Level Security',
      postgresConnected: true,
      supabaseConnected: !error,
      dbTime: pgResult.rows[0].current_time,
      timestamp: new Date().toISOString(),
      note: 'Using PostgreSQL fallback for data queries due to Supabase API schema configuration'
    });
  } catch (error) {
    console.error('Database status check failed:', error);
    res.status(500).json({ 
      connected: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get/Create user profile - POSTGRESQL ONLY (more reliable)
app.get('/api/auth/profile', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('ℹ️ Using PostgreSQL for profile query (more reliable)');
    
    // Use PostgreSQL directly (more reliable than Supabase client for this use case)
    let result = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    
    let profile;
    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        'INSERT INTO user_profiles (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
      profile = insertResult.rows[0];
    } else {
      profile = result.rows[0];
    }

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
        updatedAt: profile.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ 
      error: 'Failed to fetch profile',
      message: error.message 
    });
  }
});

// Update user profile - POSTGRESQL ONLY (more reliable)
app.put('/api/auth/profile', authenticateSupabaseUser, async (req, res) => {
  try {
    const { error: validationError, value } = userProfileSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validationError.details.map(detail => detail.message)
      });
    }

    const userId = req.user.id;
    const updateData = {
      ...value,
      updated_at: new Date().toISOString()
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    console.log('ℹ️ Using PostgreSQL for profile update (more reliable)');
    
    // Use PostgreSQL directly
    const updateColumns = Object.keys(updateData);
    const setClause = updateColumns.map((col, index) => `${col} = $${index + 2}`).join(', ');
    const values = [userId, ...updateColumns.map(col => updateData[col])];
    
    const result = await pool.query(
      `UPDATE user_profiles SET ${setClause} WHERE user_id = $1 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const profile = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: req.user.id,
        email: req.user.email,
        phone: profile.phone,
        tradingExperience: profile.trading_experience,
        preferredMarket: profile.preferred_market,
        riskTolerance: profile.risk_tolerance,
        updatedAt: profile.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ 
      error: 'Failed to update profile',
      message: error.message 
    });
  }
});

// Get trades - POSTGRESQL ONLY (more reliable)
app.get('/api/trades', authenticateSupabaseUser, async (req, res) => {
  try {
    const { status, strategy, limit = 1000 } = req.query;
    const userId = req.user.id;
    
    console.log('ℹ️ Using PostgreSQL for trades query (more reliable)');
    
    // Use PostgreSQL directly with manual user filtering
    let pgQuery = 'SELECT * FROM trading_journal WHERE user_id = $1';
    const values = [userId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      pgQuery += ` AND status = $${paramCount}`;
      values.push(status);
    }

    if (strategy) {
      paramCount++;
      pgQuery += ` AND strategy = $${paramCount}`;
      values.push(strategy);
    }

    pgQuery += ` ORDER BY s_no DESC LIMIT $${paramCount + 1}`;
    values.push(parseInt(limit));

    const result = await pool.query(pgQuery, values);
    const trades = result.rows;

    // Format trades data - convert strings to numbers
    const formattedTrades = formatTradesData(trades || []);

    res.json({
      trades: formattedTrades,
      count: formattedTrades.length
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trades',
      message: error.message 
    });
  }
});

// Add new trade - POSTGRESQL ONLY (more reliable)
app.post('/api/trades', authenticateSupabaseUser, async (req, res) => {
  try {
    const { error: validationError, value } = tradeSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validationError.details.map(detail => detail.message)
      });
    }

    const tradeData = {
      user_id: req.user.id,
      status: value.status,
      broker: value.broker,
      market: value.market,
      instrument: value.instrument,
      direction: value.direction,
      qty: value.qty,
      entry_price: value.entry_price,
      exit_price: value.exit_price || null,
      entry_dt: value.entry_dt,
      exit_dt: value.exit_dt || null,
      stoploss: value.stoploss,
      commission: value.commission,
      p_and_l: value.p_and_l || null,
      strategy: value.strategy,
      setup: value.setup || null,
      reason: value.reason || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('ℹ️ Using PostgreSQL for trade insert (more reliable)');
    
    // PostgreSQL with exact column mapping
    const result = await pool.query(`
      INSERT INTO trading_journal (
        user_id, status, broker, market, instrument, direction,
        qty, entry_price, exit_price, entry_dt, exit_dt,
        stoploss, commission, p_and_l, strategy, setup, reason,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *
    `, [
      tradeData.user_id,
      tradeData.status,
      tradeData.broker,
      tradeData.market,
      tradeData.instrument,
      tradeData.direction,
      tradeData.qty,
      tradeData.entry_price,
      tradeData.exit_price,
      tradeData.entry_dt,
      tradeData.exit_dt,
      tradeData.stoploss,
      tradeData.commission,
      tradeData.p_and_l,
      tradeData.strategy,
      tradeData.setup,
      tradeData.reason,
      tradeData.created_at,
      tradeData.updated_at
    ]);

    const trade = result.rows[0];
    console.log('✅ PostgreSQL insert successful!');

    // Format the response data
    const formattedTrade = formatTradeData(trade);

    res.status(201).json({
      message: 'Trade created successfully',
      trade: formattedTrade
    });
  } catch (error) {
    console.error('Error creating trade:', error);
    res.status(500).json({ 
      error: 'Failed to create trade',
      message: error.message 
    });
  }
});

// Update trade - POSTGRESQL ONLY (more reliable)
app.put('/api/trades/:id', authenticateSupabaseUser, async (req, res) => {
  try {
    const tradeId = req.params.id;
    const userId = req.user.id;
    
    const { error: validationError, value } = tradeSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validationError.details.map(detail => detail.message)
      });
    }

    const updateData = {
      ...value,
      updated_at: new Date().toISOString()
    };

    console.log('ℹ️ Using PostgreSQL for trade update (more reliable)');
    
    // PostgreSQL update
    const result = await pool.query(`
      UPDATE trading_journal SET
        status = $3, broker = $4, market = $5, instrument = $6, direction = $7,
        qty = $8, entry_price = $9, exit_price = $10, entry_dt = $11, exit_dt = $12,
        stoploss = $13, commission = $14, p_and_l = $15, strategy = $16,
        setup = $17, reason = $18, updated_at = $19
      WHERE s_no = $1 AND user_id = $2
      RETURNING *
    `, [
      tradeId, userId, updateData.status, updateData.broker, updateData.market,
      updateData.instrument, updateData.direction, updateData.qty, updateData.entry_price,
      updateData.exit_price, updateData.entry_dt, updateData.exit_dt, updateData.stoploss,
      updateData.commission, updateData.p_and_l, updateData.strategy, updateData.setup,
      updateData.reason, updateData.updated_at
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trade not found or unauthorized' });
    }
    const trade = result.rows[0];

    // Format the response data
    const formattedTrade = formatTradeData(trade);

    res.json({
      message: 'Trade updated successfully',
      trade: formattedTrade
    });
  } catch (error) {
    console.error('Error updating trade:', error);
    res.status(500).json({ 
      error: 'Failed to update trade',
      message: error.message 
    });
  }
});

// Delete trade - POSTGRESQL ONLY (more reliable)
app.delete('/api/trades/:id', authenticateSupabaseUser, async (req, res) => {
  try {
    const tradeId = req.params.id;
    const userId = req.user.id;

    console.log('ℹ️ Using PostgreSQL for trade delete (more reliable)');
    
    // PostgreSQL delete
    const result = await pool.query(
      'DELETE FROM trading_journal WHERE s_no = $1 AND user_id = $2 RETURNING s_no',
      [tradeId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trade not found or unauthorized' });
    }
    const trade = result.rows[0];

    res.json({
      message: 'Trade deleted successfully',
      tradeId: trade.s_no
    });
  } catch (error) {
    console.error('Error deleting trade:', error);
    res.status(500).json({ 
      error: 'Failed to delete trade',
      message: error.message 
    });
  }
});

// Get trading statistics - POSTGRESQL ONLY (more reliable)
app.get('/api/analytics/stats', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('ℹ️ Using PostgreSQL for stats query (more reliable)');
    
    // PostgreSQL query
    const result = await pool.query(
      'SELECT status, p_and_l FROM trading_journal WHERE user_id = $1',
      [userId]
    );
    const trades = result.rows;

    const totalTrades = trades.length;
    const openTrades = trades.filter(t => t.status === 'open').length;
    const closedTrades = trades.filter(t => t.status === 'closed').length;
    
    const pnlValues = trades
      .filter(t => t.p_and_l !== null && t.p_and_l !== undefined)
      .map(t => safeParseFloat(t.p_and_l))
      .filter(val => val !== null);
    
    const totalPnl = pnlValues.reduce((sum, val) => sum + val, 0);
    const avgPnl = pnlValues.length > 0 ? totalPnl / pnlValues.length : 0;
    const winningTrades = pnlValues.filter(val => val > 0).length;
    const losingTrades = pnlValues.filter(val => val < 0).length;
    const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
    const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;
    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;

    res.json({
      total_trades: totalTrades,
      open_trades: openTrades,
      closed_trades: closedTrades,
      winning_trades: winningTrades,
      losing_trades: losingTrades,
      total_pnl: parseFloat(totalPnl.toFixed(2)),
      avg_pnl: parseFloat(avgPnl.toFixed(2)),
      best_trade: parseFloat(bestTrade.toFixed(2)),
      worst_trade: parseFloat(worstTrade.toFixed(2)),
      win_rate: parseFloat(winRate.toFixed(2))
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: error.message 
    });
  }
});

// Advanced Analytics Endpoints - POSTGRESQL ONLY (more reliable)
app.get('/api/analytics/advanced-stats', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('ℹ️ Using PostgreSQL for advanced stats query (more reliable)');
    
    // Get all trades for the user using PostgreSQL
    const result = await pool.query(
      'SELECT * FROM trading_journal WHERE user_id = $1 ORDER BY entry_dt',
      [userId]
    );
    const trades = result.rows;

    if (!trades || trades.length === 0) {
      return res.json({
        stats: {
          basic: {
            totalTrades: 0,
            closedTrades: 0,
            openTrades: 0,
            totalPnL: 0,
            avgPnL: 0,
            winRate: 0,
            profitFactor: 0,
            expectancy: 0
          },
          risk: {
            sharpeRatio: 0,
            maxDrawdown: 0,
            calmarRatio: 0,
            var95: 0,
            var99: 0,
            volatility: 0
          },
          performance: {
            avgWin: 0,
            avgLoss: 0,
            largestWin: 0,
            largestLoss: 0,
            riskRewardRatio: 0,
            kellyPercentage: 0,
            annualReturn: 0
          },
          time: {
            firstTradeDate: null,
            lastTradeDate: null,
            tradingDays: 0,
            avgTradesPerMonth: 0
          }
        }
      });
    }

    const formattedTrades = formatTradesData(trades);
    const closedTrades = formattedTrades.filter(t => t.status === 'closed' && t.p_and_l !== null);
    
    if (closedTrades.length === 0) {
      return res.json({
        stats: {
          basic: {
            totalTrades: trades.length,
            closedTrades: 0,
            openTrades: trades.length,
            totalPnL: 0,
            avgPnL: 0,
            winRate: 0,
            profitFactor: 0,
            expectancy: 0
          },
          risk: {
            sharpeRatio: 0,
            maxDrawdown: 0,
            calmarRatio: 0,
            var95: 0,
            var99: 0,
            volatility: 0
          },
          performance: {
            avgWin: 0,
            avgLoss: 0,
            largestWin: 0,
            largestLoss: 0,
            riskRewardRatio: 0,
            kellyPercentage: 0,
            annualReturn: 0
          },
          time: {
            firstTradeDate: formattedTrades[0]?.entry_dt || null,
            lastTradeDate: formattedTrades[formattedTrades.length - 1]?.entry_dt || null,
            tradingDays: 0,
            avgTradesPerMonth: 0
          }
        }
      });
    }

    // Calculate basic stats
    const pnlValues = closedTrades.map(t => t.p_and_l).filter(p => p !== null);
    const totalPnL = pnlValues.reduce((sum, p) => sum + p, 0);
    const avgPnL = pnlValues.length > 0 ? totalPnL / pnlValues.length : 0;
    
    const winningTrades = pnlValues.filter(p => p > 0);
    const losingTrades = pnlValues.filter(p => p < 0);
    const winRate = pnlValues.length > 0 ? (winningTrades.length / pnlValues.length) * 100 : 0;
    
    const grossProfit = winningTrades.reduce((sum, p) => sum + p, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, p) => sum + p, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 0;
    
    const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
    
    // Risk metrics
    const volatility = pnlValues.length > 1 ? ss.standardDeviation(pnlValues) : 0;
    const sharpeRatio = volatility > 0 ? avgPnL / volatility : 0;
    
    // Drawdown calculation
    let cumulativePnL = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    for (const pnl of pnlValues) {
      cumulativePnL += pnl;
      if (cumulativePnL > peak) peak = cumulativePnL;
      const drawdown = (peak - cumulativePnL) / Math.max(peak, 1);
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    // Time calculations
    const sortedTrades = closedTrades.sort((a, b) => new Date(a.entry_dt).getTime() - new Date(b.entry_dt).getTime());
    const firstTradeDate = sortedTrades[0]?.entry_dt;
    const lastTradeDate = sortedTrades[sortedTrades.length - 1]?.entry_dt;
    
    let tradingDays = 0;
    let annualReturn = 0;
    if (firstTradeDate && lastTradeDate) {
      const daysDiff = (new Date(lastTradeDate).getTime() - new Date(firstTradeDate).getTime()) / (1000 * 60 * 60 * 24);
      tradingDays = Math.max(daysDiff, 1);
      annualReturn = totalPnL > 0 ? (totalPnL / Math.max(grossProfit, 1000)) * (365 / tradingDays) : 0;
    }
    
    // VaR calculations
    const sortedPnL = [...pnlValues].sort((a, b) => a - b);
    const var95Index = Math.floor(sortedPnL.length * 0.05);
    const var99Index = Math.floor(sortedPnL.length * 0.01);
    const var95 = sortedPnL[var95Index] || 0;
    const var99 = sortedPnL[var99Index] || 0;
    
    // Kelly criterion
    const kellyPercentage = winRate > 0 && avgLoss > 0 ? 
      ((winRate / 100) * (avgWin / avgLoss) - (1 - winRate / 100)) * 100 : 0;

    const stats = {
      basic: {
        totalTrades: formattedTrades.length,
        closedTrades: closedTrades.length,
        openTrades: formattedTrades.length - closedTrades.length,
        totalPnL: parseFloat(totalPnL.toFixed(2)),
        avgPnL: parseFloat(avgPnL.toFixed(2)),
        winRate: parseFloat(winRate.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        expectancy: parseFloat(avgPnL.toFixed(2))
      },
      risk: {
        sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(4)),
        calmarRatio: maxDrawdown > 0 ? parseFloat((annualReturn / maxDrawdown).toFixed(2)) : 0,
        var95: parseFloat(var95.toFixed(2)),
        var99: parseFloat(var99.toFixed(2)),
        volatility: parseFloat((volatility / Math.max(avgPnL, 1)).toFixed(4))
      },
      performance: {
        avgWin: parseFloat(avgWin.toFixed(2)),
        avgLoss: parseFloat(avgLoss.toFixed(2)),
        largestWin: pnlValues.length > 0 ? parseFloat(Math.max(...pnlValues).toFixed(2)) : 0,
        largestLoss: pnlValues.length > 0 ? parseFloat(Math.min(...pnlValues).toFixed(2)) : 0,
        riskRewardRatio: avgLoss > 0 ? parseFloat((avgWin / avgLoss).toFixed(2)) : 0,
        kellyPercentage: parseFloat(kellyPercentage.toFixed(2)),
        annualReturn: parseFloat(annualReturn.toFixed(4))
      },
      time: {
        firstTradeDate: firstTradeDate || null,
        lastTradeDate: lastTradeDate || null,
        tradingDays: Math.floor(tradingDays),
        avgTradesPerMonth: tradingDays > 30 ? parseFloat((closedTrades.length / (tradingDays / 30)).toFixed(2)) : closedTrades.length
      }
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching advanced stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch advanced statistics',
      message: error.message 
    });
  }
});

// Time series data endpoint - POSTGRESQL ONLY (more reliable)
app.get('/api/analytics/time-series', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'daily' } = req.query;

    console.log('ℹ️ Using PostgreSQL for time-series query (more reliable)');
    
    // Get all trades for the user using PostgreSQL
    const result = await pool.query(
      'SELECT * FROM trading_journal WHERE user_id = $1 ORDER BY entry_dt',
      [userId]
    );
    const trades = result.rows;

    if (!trades || trades.length === 0) {
      return res.json({ data: [] });
    }

    const formattedTrades = formatTradesData(trades);
    const timeSeriesData = [];
    
    // Group trades by period
    const groupedTrades = {};
    
    formattedTrades.forEach(trade => {
      const date = new Date(trade.entry_dt);
      let periodKey;
      
      switch (period) {
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().slice(0, 10);
          break;
        case 'monthly':
          periodKey = date.toISOString().slice(0, 7);
          break;
        default: // daily
          periodKey = date.toISOString().slice(0, 10);
      }
      
      if (!groupedTrades[periodKey]) {
        groupedTrades[periodKey] = {
          period: periodKey,
          trades: 0,
          totalPnL: 0,
          wins: 0,
          losses: 0,
          volume: 0
        };
      }
      
      const group = groupedTrades[periodKey];
      group.trades += 1;
      group.volume += trade.qty * trade.entry_price;
      
      if (trade.p_and_l !== null) {
        group.totalPnL += trade.p_and_l;
        if (trade.p_and_l > 0) group.wins += 1;
        if (trade.p_and_l < 0) group.losses += 1;
      }
    });
    
    // Convert to array and add cumulative data
    let cumulativePnL = 0;
    Object.keys(groupedTrades)
      .sort()
      .forEach(periodKey => {
        const group = groupedTrades[periodKey];
        cumulativePnL += group.totalPnL;
        
        timeSeriesData.push({
          period: group.period,
          trades: group.trades,
          totalPnL: parseFloat(group.totalPnL.toFixed(2)),
          wins: group.wins,
          losses: group.losses,
          volume: parseFloat(group.volume.toFixed(2)),
          cumulativePnL: parseFloat(cumulativePnL.toFixed(2)),
          winRate: group.trades > 0 ? parseFloat(((group.wins / group.trades) * 100).toFixed(2)) : 0,
          avgPnL: group.trades > 0 ? parseFloat((group.totalPnL / group.trades).toFixed(2)) : 0
        });
      });

    res.json({ data: timeSeriesData });
  } catch (error) {
    console.error('Error fetching time series data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch time series data',
      message: error.message 
    });
  }
});

// Patterns analysis endpoint - POSTGRESQL ONLY (more reliable)
app.get('/api/analytics/patterns', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('ℹ️ Using PostgreSQL for patterns query (more reliable)');
    
    // Get all trades for the user using PostgreSQL
    const result = await pool.query(
      'SELECT * FROM trading_journal WHERE user_id = $1 ORDER BY entry_dt',
      [userId]
    );
    const trades = result.rows;

    if (!trades || trades.length === 0) {
      return res.json({
        patterns: {
          bestWinStreak: 0,
          worstLossStreak: 0,
          dayOfWeekPerformance: {},
          instrumentPerformance: {}
        }
      });
    }

    const formattedTrades = formatTradesData(trades);
    const closedTrades = formattedTrades.filter(t => t.status === 'closed' && t.p_and_l !== null);

    // Calculate streaks
    let currentStreak = 0;
    let bestWinStreak = 0;
    let worstLossStreak = 0;
    let currentLossStreak = 0;

    closedTrades.forEach(trade => {
      if (trade.p_and_l > 0) {
        currentStreak += 1;
        currentLossStreak = 0;
        bestWinStreak = Math.max(bestWinStreak, currentStreak);
      } else if (trade.p_and_l < 0) {
        currentStreak = 0;
        currentLossStreak += 1;
        worstLossStreak = Math.max(worstLossStreak, currentLossStreak);
      }
    });

    // Day of week analysis
    const dayOfWeekPerformance = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    closedTrades.forEach(trade => {
      const dayIndex = new Date(trade.entry_dt).getDay();
      const dayName = dayNames[dayIndex];
      
      if (!dayOfWeekPerformance[dayName]) {
        dayOfWeekPerformance[dayName] = {
          trades: 0,
          totalPnL: 0,
          wins: 0
        };
      }
      
      dayOfWeekPerformance[dayName].trades += 1;
      dayOfWeekPerformance[dayName].totalPnL += trade.p_and_l;
      if (trade.p_and_l > 0) dayOfWeekPerformance[dayName].wins += 1;
    });

    // Add win rates
    Object.keys(dayOfWeekPerformance).forEach(day => {
      const data = dayOfWeekPerformance[day];
      data.winRate = data.trades > 0 ? (data.wins / data.trades) * 100 : 0;
      data.totalPnL = parseFloat(data.totalPnL.toFixed(2));
      data.winRate = parseFloat(data.winRate.toFixed(2));
    });

    // Instrument performance analysis
    const instrumentPerformance = {};

    closedTrades.forEach(trade => {
      if (!instrumentPerformance[trade.instrument]) {
        instrumentPerformance[trade.instrument] = {
          trades: 0,
          totalPnL: 0,
          wins: 0
        };
      }
      
      instrumentPerformance[trade.instrument].trades += 1;
      instrumentPerformance[trade.instrument].totalPnL += trade.p_and_l;
      if (trade.p_and_l > 0) instrumentPerformance[trade.instrument].wins += 1;
    });

    // Add win rates and avg PnL
    Object.keys(instrumentPerformance).forEach(instrument => {
      const data = instrumentPerformance[instrument];
      data.winRate = data.trades > 0 ? (data.wins / data.trades) * 100 : 0;
      data.avgPnL = data.trades > 0 ? data.totalPnL / data.trades : 0;
      data.totalPnL = parseFloat(data.totalPnL.toFixed(2));
      data.winRate = parseFloat(data.winRate.toFixed(2));
      data.avgPnL = parseFloat(data.avgPnL.toFixed(2));
    });

    res.json({
      patterns: {
        bestWinStreak,
        worstLossStreak,
        dayOfWeekPerformance,
        instrumentPerformance
      }
    });
  } catch (error) {
    console.error('Error fetching patterns data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch patterns data',
      message: error.message 
    });
  }
});

// Supabase webhook endpoint for user creation
app.post('/api/webhooks/supabase', async (req, res) => {
  try {
    const { type, record } = req.body;
    
    if (type === 'INSERT' && record.email) {
      // Create user profile when a new user signs up via Supabase Auth
      // Use PostgreSQL for reliability
      try {
        await pool.query(
          'INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
          [record.id]
        );
        console.log(`✅ Created profile for user: ${record.email}`);
      } catch (pgError) {
        console.error('Webhook profile creation failed:', pgError);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// Start server
const startServer = async () => {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    console.log('✅ Supabase connection successful');
    
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on: http://localhost:${PORT}`);
      console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
      console.log(`💾 DB status: http://localhost:${PORT}/api/db-status`);
      console.log('✅ Server ready with Supabase authentication!');
      console.log('🔒 Security: Authentication + PostgreSQL Direct Access (Reliable)');
      console.log('🔢 Data Formatting: Automatic number conversion for frontend compatibility');
      console.log('ℹ️ Note: Using PostgreSQL direct access for better reliability');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Please ensure your Supabase configuration is correct and try again.');
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

startServer();