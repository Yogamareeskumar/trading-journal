const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Joi = require('joi');
const math = require('mathjs');
const ss = require('simple-statistics');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// JWT Secret (add this to your .env file)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL connection pool for Supabase
const pool = new Pool({
  host: 'db.fsicauceosmdrhxmvreu.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '3146',
  database: 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: false
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Validation schemas
const userSignupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  tradingExperience: Joi.string().valid('beginner', 'intermediate', 'advanced', 'professional').optional(),
  preferredMarket: Joi.string().optional(),
  riskTolerance: Joi.string().valid('low', 'medium', 'high').optional()
});

const userSigninSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const tradeSchema = Joi.object({
  gmail: Joi.string().email().required(),
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

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Create database tables on startup
const initializeDatabase = async () => {
  try {
    // Users table
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(15),
        trading_experience VARCHAR(20) CHECK (trading_experience IN ('beginner', 'intermediate', 'advanced', 'professional')),
        preferred_market VARCHAR(100),
        risk_tolerance VARCHAR(10) CHECK (risk_tolerance IN ('low', 'medium', 'high')),
        is_active BOOLEAN DEFAULT TRUE,
        email_verified BOOLEAN DEFAULT FALSE,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    `;

    // Trading journal table (enhanced)
    const createTradingTableQuery = `
      CREATE TABLE IF NOT EXISTS trading_journal (
        s_no SERIAL PRIMARY KEY,
        id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
        gmail VARCHAR(255) NOT NULL,
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

      CREATE INDEX IF NOT EXISTS idx_trading_journal_user_id ON trading_journal(id);
      CREATE INDEX IF NOT EXISTS idx_trading_journal_gmail ON trading_journal(gmail);
      CREATE INDEX IF NOT EXISTS idx_trading_journal_status ON trading_journal(status);
      CREATE INDEX IF NOT EXISTS idx_trading_journal_entry_dt ON trading_journal(entry_dt);
      CREATE INDEX IF NOT EXISTS idx_trading_journal_strategy ON trading_journal(strategy);
      CREATE INDEX IF NOT EXISTS idx_trading_journal_instrument ON trading_journal(instrument);
    `;

    await pool.query(createUsersTableQuery);
    await pool.query(createTradingTableQuery);
    console.log('✅ Database tables created successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

// Data Science Helper Functions (keep existing TradingAnalytics class)
class TradingAnalytics {
  static calculateSharpeRatio(returns, riskFreeRate = 0.02) {
    if (returns.length < 2) return 0;
    const excessReturns = returns.map(r => r - riskFreeRate / 252);
    const avgExcessReturn = ss.mean(excessReturns);
    const stdDev = ss.standardDeviation(excessReturns);
    return stdDev === 0 ? 0 : (avgExcessReturn / stdDev) * Math.sqrt(252);
  }

  static calculateMaxDrawdown(cumulativePnL) {
    if (cumulativePnL.length === 0) return 0;
    let maxDrawdown = 0;
    let peak = cumulativePnL[0];
    
    for (let i = 1; i < cumulativePnL.length; i++) {
      if (cumulativePnL[i] > peak) {
        peak = cumulativePnL[i];
      }
      const drawdown = (peak - cumulativePnL[i]) / Math.max(peak, 1);
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    return maxDrawdown;
  }

  static calculateVaR(returns, confidence = 0.05) {
    if (returns.length === 0) return 0;
    const sortedReturns = returns.sort((a, b) => a - b);
    const index = Math.floor(confidence * sortedReturns.length);
    return sortedReturns[index] || 0;
  }

  static calculateCalmarRatio(annualReturn, maxDrawdown) {
    return maxDrawdown === 0 ? 0 : annualReturn / maxDrawdown;
  }

  static calculateWinRate(trades) {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.p_and_l !== null);
    if (closedTrades.length === 0) return 0;
    const winningTrades = closedTrades.filter(t => t.p_and_l > 0);
    return (winningTrades.length / closedTrades.length) * 100;
  }

  static calculateProfitFactor(trades) {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.p_and_l !== null);
    const grossProfit = closedTrades.filter(t => t.p_and_l > 0).reduce((sum, t) => sum + t.p_and_l, 0);
    const grossLoss = Math.abs(closedTrades.filter(t => t.p_and_l < 0).reduce((sum, t) => sum + t.p_and_l, 0));
    return grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;
  }

  static calculateExpectancy(trades) {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.p_and_l !== null);
    if (closedTrades.length === 0) return 0;
    
    const winners = closedTrades.filter(t => t.p_and_l > 0);
    const losers = closedTrades.filter(t => t.p_and_l < 0);
    
    const winRate = winners.length / closedTrades.length;
    const lossRate = losers.length / closedTrades.length;
    const avgWin = winners.length > 0 ? ss.mean(winners.map(t => t.p_and_l)) : 0;
    const avgLoss = losers.length > 0 ? Math.abs(ss.mean(losers.map(t => t.p_and_l))) : 0;
    
    return (winRate * avgWin) - (lossRate * avgLoss);
  }

  static detectPatterns(trades) {
    const patterns = {
      consecutiveWins: 0,
      consecutiveLosses: 0,
      bestWinStreak: 0,
      worstLossStreak: 0,
      dayOfWeekPerformance: {},
      hourlyPerformance: {},
      instrumentPerformance: {},
      strategyEffectiveness: {}
    };

    const closedTrades = trades.filter(t => t.status === 'closed' && t.p_and_l !== null)
                             .sort((a, b) => new Date(a.exit_dt) - new Date(b.exit_dt));

    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    closedTrades.forEach(trade => {
      if (trade.p_and_l > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else if (trade.p_and_l < 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      }
    });

    patterns.bestWinStreak = maxWinStreak;
    patterns.worstLossStreak = maxLossStreak;

    closedTrades.forEach(trade => {
      const dayOfWeek = new Date(trade.exit_dt).getDay();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dayOfWeek];
      
      if (!patterns.dayOfWeekPerformance[dayName]) {
        patterns.dayOfWeekPerformance[dayName] = { trades: 0, totalPnL: 0, winRate: 0 };
      }
      
      patterns.dayOfWeekPerformance[dayName].trades++;
      patterns.dayOfWeekPerformance[dayName].totalPnL += trade.p_and_l;
    });

    Object.keys(patterns.dayOfWeekPerformance).forEach(day => {
      const dayTrades = closedTrades.filter(t => {
        const dayOfWeek = new Date(t.exit_dt).getDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return dayNames[dayOfWeek] === day;
      });
      const wins = dayTrades.filter(t => t.p_and_l > 0).length;
      patterns.dayOfWeekPerformance[day].winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;
    });

    closedTrades.forEach(trade => {
      if (!patterns.instrumentPerformance[trade.instrument]) {
        patterns.instrumentPerformance[trade.instrument] = { 
          trades: 0, 
          totalPnL: 0, 
          winRate: 0,
          avgPnL: 0 
        };
      }
      
      patterns.instrumentPerformance[trade.instrument].trades++;
      patterns.instrumentPerformance[trade.instrument].totalPnL += trade.p_and_l;
    });

    Object.keys(patterns.instrumentPerformance).forEach(instrument => {
      const instrumentTrades = closedTrades.filter(t => t.instrument === instrument);
      const wins = instrumentTrades.filter(t => t.p_and_l > 0).length;
      patterns.instrumentPerformance[instrument].winRate = (wins / instrumentTrades.length) * 100;
      patterns.instrumentPerformance[instrument].avgPnL = patterns.instrumentPerformance[instrument].totalPnL / instrumentTrades.length;
    });

    return patterns;
  }
}

// USER AUTHENTICATION ROUTES

// User Registration
app.post('/api/auth/signup', async (req, res) => {
  try {
    // Validate input
    const { error, value } = userSignupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { email, password, firstName, lastName, phone, tradingExperience, preferredMarket, riskTolerance } = value;

    // Check if user already exists
    const existingUser = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const insertUserQuery = `
      INSERT INTO users (
        email, password_hash, first_name, last_name, phone, 
        trading_experience, preferred_market, risk_tolerance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING user_id, email, first_name, last_name, phone, trading_experience, preferred_market, risk_tolerance, created_at
    `;

    const values = [
      email, passwordHash, firstName, lastName, phone || null,
      tradingExperience || 'beginner', preferredMarket || null, riskTolerance || 'medium'
    ];

    const result = await pool.query(insertUserQuery, values);
    const newUser = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser.user_id, 
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: newUser.user_id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        phone: newUser.phone,
        tradingExperience: newUser.trading_experience,
        preferredMarket: newUser.preferred_market,
        riskTolerance: newUser.risk_tolerance,
        createdAt: newUser.created_at
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      error: 'Failed to create user',
      message: error.message 
    });
  }
});

// User Login
app.post('/api/auth/signin', async (req, res) => {
  try {
    // Validate input
    const { error, value } = userSigninSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    const { email, password } = value;

    // Find user
    const userQuery = `
      SELECT user_id, email, password_hash, first_name, last_name, phone, 
             trading_experience, preferred_market, risk_tolerance, is_active
      FROM users 
      WHERE email = $1
    `;
    
    const userResult = await pool.query(userQuery, [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        error: 'Account disabled',
        message: 'Your account has been disabled. Please contact support.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1', [user.user_id]);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.user_id, 
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        tradingExperience: user.trading_experience,
        preferredMarket: user.preferred_market,
        riskTolerance: user.risk_tolerance
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: error.message 
    });
  }
});

// Get user profile (protected route)
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userQuery = `
      SELECT user_id, email, first_name, last_name, phone, 
             trading_experience, preferred_market, risk_tolerance, created_at, last_login
      FROM users 
      WHERE user_id = $1
    `;
    
    const result = await pool.query(userQuery, [req.user.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        tradingExperience: user.trading_experience,
        preferredMarket: user.preferred_market,
        riskTolerance: user.risk_tolerance,
        createdAt: user.created_at,
        lastLogin: user.last_login
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

// Token validation
app.post('/api/auth/validate-token', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.userId,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    }
  });
});

// Logout (invalidate token - client-side)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({
    message: 'Logout successful',
    note: 'Token should be removed from client storage'
  });
});

// EXISTING ROUTES (keep all your existing trading routes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Trading Journal API with Authentication is running!',
    timestamp: new Date().toISOString()
  });
});

// Database status check
app.get('/api/db-status', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      connected: true, 
      message: 'Database connected successfully',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      connected: false, 
      error: error.message 
    });
  }
});

// Protected trading routes (require authentication)
app.get('/api/trades', authenticateToken, async (req, res) => {
  try {
    const { status, strategy, limit = 1000 } = req.query;
    const userEmail = req.user.email;
    
    let query = `
      SELECT s_no, gmail, status, broker, market, instrument, direction, 
             qty, entry_price, exit_price, entry_dt, exit_dt, stoploss, 
             commission, p_and_l, strategy, setup, reason
      FROM trading_journal 
      WHERE gmail = $1
    `;
    const values = [userEmail];
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
    
    const trades = result.rows.map(row => ({
      ...row,
      qty: parseFloat(row.qty),
      entry_price: parseFloat(row.entry_price),
      exit_price: row.exit_price ? parseFloat(row.exit_price) : null,
      stoploss: parseFloat(row.stoploss),
      commission: parseFloat(row.commission),
      p_and_l: row.p_and_l ? parseFloat(row.p_and_l) : null
    }));

    res.json({
      trades,
      count: trades.length
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trades',
      message: error.message 
    });
  }
});

// Add new trade (protected)
app.post('/api/trades', authenticateToken, async (req, res) => {
  try {
    // Override gmail with authenticated user's email
    const tradeData = { ...req.body, gmail: req.user.email };
    
    const { error, value } = tradeSchema.validate(tradeData);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    const {
      gmail, status, broker, market, instrument, direction, qty,
      entry_price, exit_price, entry_dt, exit_dt, stoploss, commission,
      p_and_l, strategy, setup, reason
    } = value;

    const query = `
      INSERT INTO trading_journal (
        gmail, status, broker, market, instrument, direction, qty, 
        entry_price, exit_price, entry_dt, exit_dt, stoploss, 
        commission, p_and_l, strategy, setup, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const values = [
      gmail, status, broker, market, instrument, direction, qty,
      entry_price, exit_price || null, entry_dt, exit_dt || null,
      stoploss, commission, p_and_l || null, strategy, setup || null, reason || null
    ];

    const result = await pool.query(query, values);
    const savedTrade = {
      ...result.rows[0],
      qty: parseFloat(result.rows[0].qty),
      entry_price: parseFloat(result.rows[0].entry_price),
      exit_price: result.rows[0].exit_price ? parseFloat(result.rows[0].exit_price) : null,
      stoploss: parseFloat(result.rows[0].stoploss),
      commission: parseFloat(result.rows[0].commission),
      p_and_l: result.rows[0].p_and_l ? parseFloat(result.rows[0].p_and_l) : null
    };

    res.status(201).json({
      message: 'Trade created successfully',
      trade: savedTrade
    });
  } catch (error) {
    console.error('Error creating trade:', error);
    res.status(500).json({ 
      error: 'Failed to create trade',
      message: error.message 
    });
  }
});

// Update existing trade (protected)
app.put('/api/trades/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const tradeData = { ...req.body, s_no: parseInt(id), gmail: req.user.email };

    const updateSchema = tradeSchema.keys({
      s_no: Joi.number().integer().positive().required()
    });
    
    const { error, value } = updateSchema.validate(tradeData);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    const {
      gmail, status, broker, market, instrument, direction, qty,
      entry_price, exit_price, entry_dt, exit_dt, stoploss, commission,
      p_and_l, strategy, setup, reason
    } = value;

    const query = `
      UPDATE trading_journal SET
        gmail = $1, status = $2, broker = $3, market = $4, instrument = $5,
        direction = $6, qty = $7, entry_price = $8, exit_price = $9,
        entry_dt = $10, exit_dt = $11, stoploss = $12, commission = $13,
        p_and_l = $14, strategy = $15, setup = $16, reason = $17,
        updated_at = CURRENT_TIMESTAMP
      WHERE s_no = $18 AND gmail = $19
      RETURNING *
    `;

    const values = [
      gmail, status, broker, market, instrument, direction, qty,
      entry_price, exit_price || null, entry_dt, exit_dt || null,
      stoploss, commission, p_and_l || null, strategy, setup || null, 
      reason || null, id, gmail
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Trade not found or access denied' 
      });
    }

    const updatedTrade = {
      ...result.rows[0],
      qty: parseFloat(result.rows[0].qty),
      entry_price: parseFloat(result.rows[0].entry_price),
      exit_price: result.rows[0].exit_price ? parseFloat(result.rows[0].exit_price) : null,
      stoploss: parseFloat(result.rows[0].stoploss),
      commission: parseFloat(result.rows[0].commission),
      p_and_l: result.rows[0].p_and_l ? parseFloat(result.rows[0].p_and_l) : null
    };

    res.json({
      message: 'Trade updated successfully',
      trade: updatedTrade
    });
  } catch (error) {
    console.error('Error updating trade:', error);
    res.status(500).json({ 
      error: 'Failed to update trade',
      message: error.message 
    });
  }
});

// Delete trade (protected)
app.delete('/api/trades/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;
    
    const query = 'DELETE FROM trading_journal WHERE s_no = $1 AND gmail = $2 RETURNING s_no';
    const result = await pool.query(query, [id, userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Trade not found or access denied' 
      });
    }

    res.json({
      message: 'Trade deleted successfully',
      deletedId: result.rows[0].s_no
    });
  } catch (error) {
    console.error('Error deleting trade:', error);
    res.status(500).json({ 
      error: 'Failed to delete trade',
      message: error.message 
    });
  }
});

// Get trading statistics (protected)
app.get('/api/analytics/stats', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;

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
      WHERE gmail = $1
    `;

    const result = await pool.query(statsQuery, [userEmail]);
    const stats = result.rows[0];

    const winRate = stats.closed_trades > 0 
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
      win_rate: parseFloat(winRate)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: error.message 
    });
  }
});

// Get advanced trading statistics (protected)
app.get('/api/analytics/advanced-stats', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;

    const tradesQuery = `
      SELECT * FROM trading_journal 
      WHERE gmail = $1 
      ORDER BY entry_dt ASC
    `;
    const tradesResult = await pool.query(tradesQuery, [userEmail]);
    const trades = tradesResult.rows.map(row => ({
      ...row,
      qty: parseFloat(row.qty),
      entry_price: parseFloat(row.entry_price),
      exit_price: row.exit_price ? parseFloat(row.exit_price) : null,
      stoploss: parseFloat(row.stoploss),
      commission: parseFloat(row.commission),
      p_and_l: row.p_and_l ? parseFloat(row.p_and_l) : null
    }));

    const closedTrades = trades.filter(t => t.status === 'closed' && t.p_and_l !== null);
    
    if (closedTrades.length === 0) {
      return res.json({
        message: 'No closed trades available for analysis',
        stats: null
      });
    }

    const totalTrades = trades.length;
    const totalPnL = closedTrades.reduce((sum, t) => sum + t.p_and_l, 0);
    const wins = closedTrades.filter(t => t.p_and_l > 0);
    const losses = closedTrades.filter(t => t.p_and_l < 0);
    
    let cumulativePnL = 0;
    const returns = [];
    const cumulativePnLArray = [];
    
    closedTrades.forEach(trade => {
      cumulativePnL += trade.p_and_l;
      cumulativePnLArray.push(cumulativePnL);
      
      const tradeValue = trade.entry_price * trade.qty;
      const returnPct = tradeValue > 0 ? (trade.p_and_l / tradeValue) : 0;
      returns.push(returnPct);
    });

    const sharpeRatio = TradingAnalytics.calculateSharpeRatio(returns);
    const maxDrawdown = TradingAnalytics.calculateMaxDrawdown(cumulativePnLArray);
    const var95 = TradingAnalytics.calculateVaR(returns, 0.05);
    const var99 = TradingAnalytics.calculateVaR(returns, 0.01);
    const winRate = TradingAnalytics.calculateWinRate(trades);
    const profitFactor = TradingAnalytics.calculateProfitFactor(trades);
    const expectancy = TradingAnalytics.calculateExpectancy(trades);
    
    const avgWin = wins.length > 0 ? ss.mean(wins.map(t => t.p_and_l)) : 0;
    const avgLoss = losses.length > 0 ? Math.abs(ss.mean(losses.map(t => t.p_and_l))) : 0;
    const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.p_and_l)) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.p_and_l)) : 0;
    
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const kelly = winRate > 0 && avgLoss > 0 ? ((winRate/100) * (avgWin/avgLoss) - ((100-winRate)/100)) / (avgWin/avgLoss) : 0;
    
    const firstTradeDate = new Date(closedTrades[0].entry_dt);
    const lastTradeDate = new Date(closedTrades[closedTrades.length - 1].exit_dt);
    const tradingDays = Math.ceil((lastTradeDate - firstTradeDate) / (1000 * 60 * 60 * 24));
    const annualReturn = tradingDays > 0 ? (totalPnL / tradingDays) * 365 : 0;
    const calmarRatio = TradingAnalytics.calculateCalmarRatio(annualReturn, maxDrawdown);

    const stats = {
      basic: {
        totalTrades,
        closedTrades: closedTrades.length,
        openTrades: totalTrades - closedTrades.length,
        totalPnL: parseFloat(totalPnL.toFixed(2)),
        avgPnL: parseFloat((totalPnL / closedTrades.length).toFixed(2)),
        winRate: parseFloat(winRate.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        expectancy: parseFloat(expectancy.toFixed(2))
      },
      risk: {
        sharpeRatio: parseFloat(sharpeRatio.toFixed(3)),
        maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
        calmarRatio: parseFloat(calmarRatio.toFixed(3)),
        var95: parseFloat((var95 * 100).toFixed(2)),
        var99: parseFloat((var99 * 100).toFixed(2)),
        volatility: returns.length > 1 ? parseFloat((ss.standardDeviation(returns) * 100).toFixed(2)) : 0
      },
      performance: {
        avgWin: parseFloat(avgWin.toFixed(2)),
        avgLoss: parseFloat(Math.abs(avgLoss).toFixed(2)),
        largestWin: parseFloat(largestWin.toFixed(2)),
        largestLoss: parseFloat(largestLoss.toFixed(2)),
        riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
        kellyPercentage: parseFloat((kelly * 100).toFixed(2)),
        annualReturn: parseFloat(annualReturn.toFixed(2))
      },
      time: {
        firstTradeDate: firstTradeDate.toISOString(),
        lastTradeDate: lastTradeDate.toISOString(),
        tradingDays,
        avgTradesPerMonth: parseFloat(((closedTrades.length / tradingDays) * 30).toFixed(1))
      }
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error calculating advanced stats:', error);
    res.status(500).json({ 
      error: 'Failed to calculate advanced statistics',
      message: error.message 
    });
  }
});

// Get pattern analysis (protected)
app.get('/api/analytics/patterns', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;

    const tradesQuery = `
      SELECT * FROM trading_journal 
      WHERE gmail = $1 
      ORDER BY entry_dt ASC
    `;
    const result = await pool.query(tradesQuery, [userEmail]);
    const trades = result.rows.map(row => ({
      ...row,
      qty: parseFloat(row.qty),
      entry_price: parseFloat(row.entry_price),
      exit_price: row.exit_price ? parseFloat(row.exit_price) : null,
      stoploss: parseFloat(row.stoploss),
      commission: parseFloat(row.commission),
      p_and_l: row.p_and_l ? parseFloat(row.p_and_l) : null
    }));

    const patterns = TradingAnalytics.detectPatterns(trades);

    res.json({ patterns });
  } catch (error) {
    console.error('Error analyzing patterns:', error);
    res.status(500).json({ 
      error: 'Failed to analyze patterns',
      message: error.message 
    });
  }
});

// Get time series data (protected)
app.get('/api/analytics/time-series', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    const userEmail = req.user.email;

    const tradesQuery = `
      SELECT * FROM trading_journal 
      WHERE gmail = $1 AND status = 'closed' AND p_and_l IS NOT NULL
      ORDER BY exit_dt ASC
    `;
    const result = await pool.query(tradesQuery, [userEmail]);
    const trades = result.rows.map(row => ({
      ...row,
      p_and_l: parseFloat(row.p_and_l),
      exit_dt: new Date(row.exit_dt)
    }));

    const timeSeriesData = {};
    let cumulativePnL = 0;

    trades.forEach(trade => {
      let periodKey;
      
      switch (period) {
        case 'hourly':
          periodKey = trade.exit_dt.toISOString().slice(0, 13) + ':00:00.000Z';
          break;
        case 'daily':
          periodKey = trade.exit_dt.toISOString().slice(0, 10);
          break;
        case 'weekly':
          const weekStart = new Date(trade.exit_dt);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          periodKey = weekStart.toISOString().slice(0, 10);
          break;
        case 'monthly':
          periodKey = trade.exit_dt.toISOString().slice(0, 7);
          break;
        default:
          periodKey = trade.exit_dt.toISOString().slice(0, 10);
      }

      if (!timeSeriesData[periodKey]) {
        timeSeriesData[periodKey] = {
          period: periodKey,
          trades: 0,
          totalPnL: 0,
          wins: 0,
          losses: 0,
          volume: 0
        };
      }

      timeSeriesData[periodKey].trades++;
      timeSeriesData[periodKey].totalPnL += trade.p_and_l;
      timeSeriesData[periodKey].volume += trade.qty * trade.entry_price;
      
      if (trade.p_and_l > 0) {
        timeSeriesData[periodKey].wins++;
      } else {
        timeSeriesData[periodKey].losses++;
      }
    });

    const timeSeriesArray = Object.values(timeSeriesData)
      .sort((a, b) => new Date(a.period) - new Date(b.period))
      .map(data => {
        cumulativePnL += data.totalPnL;
        return {
          ...data,
          cumulativePnL: parseFloat(cumulativePnL.toFixed(2)),
          winRate: data.trades > 0 ? parseFloat(((data.wins / data.trades) * 100).toFixed(2)) : 0,
          avgPnL: data.trades > 0 ? parseFloat((data.totalPnL / data.trades).toFixed(2)) : 0
        };
      });

    res.json({ 
      period,
      data: timeSeriesArray 
    });
  } catch (error) {
    console.error('Error generating time series:', error);
    res.status(500).json({ 
      error: 'Failed to generate time series data',
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'The requested endpoint does not exist' 
  });
});

// Start server
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Trading Journal API with Authentication running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔐 Authentication Endpoints:`);
      console.log(`   - Sign Up: POST http://localhost:${PORT}/api/auth/signup`);
      console.log(`   - Sign In: POST http://localhost:${PORT}/api/auth/signin`);
      console.log(`   - Profile: GET http://localhost:${PORT}/api/auth/profile`);
      console.log(`📈 Protected Analytics Endpoints:`);
      console.log(`   - Stats: GET http://localhost:${PORT}/api/analytics/stats`);
      console.log(`   - Advanced Stats: GET http://localhost:${PORT}/api/analytics/advanced-stats`);
      console.log(`   - Patterns: GET http://localhost:${PORT}/api/analytics/patterns`);
      console.log(`   - Time Series: GET http://localhost:${PORT}/api/analytics/time-series`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
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