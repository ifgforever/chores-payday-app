-- ============================================
-- Chores → Payday Database Schema
-- With Parent/Child Authentication
-- ============================================

-- Drop existing tables if migrating (careful in production!)
-- DROP TABLE IF EXISTS notifications;
-- DROP TABLE IF EXISTS chore_instances;
-- DROP TABLE IF EXISTS chores;
-- DROP TABLE IF EXISTS children;
-- DROP TABLE IF EXISTS parents;
-- DROP TABLE IF EXISTS sessions;
-- DROP TABLE IF EXISTS weekly_rules;

-- ============================================
-- Parents table (replaces admin token auth)
-- ============================================
CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for email lookups during login
CREATE INDEX IF NOT EXISTS idx_parents_email ON parents(email);

-- ============================================
-- Sessions table (server-side session storage)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('parent', 'child')),
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  ip_address TEXT,
  user_agent TEXT
);

-- Index for session lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- Children table (updated with auth fields)
-- ============================================
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  child_code TEXT UNIQUE NOT NULL,  -- Random 8-char code for child login
  pin_hash TEXT,                     -- Optional PIN (hashed)
  pin_enabled INTEGER DEFAULT 0,     -- Whether PIN is required
  pin_attempts INTEGER DEFAULT 0,    -- Failed PIN attempts (for rate limiting)
  pin_locked_until TEXT,             -- Lockout timestamp
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for child_code lookups (login)
CREATE INDEX IF NOT EXISTS idx_children_code ON children(child_code);
CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);

-- ============================================
-- Chores table
-- ============================================
CREATE TABLE IF NOT EXISTS chores (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chores_parent ON chores(parent_id);

-- ============================================
-- Chore Instances (daily chore completions)
-- ============================================
CREATE TABLE IF NOT EXISTS chore_instances (
  id TEXT PRIMARY KEY,
  chore_id TEXT NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'excused')),
  submitted_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES parents(id),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(chore_id, child_id, date)
);

CREATE INDEX IF NOT EXISTS idx_chore_instances_child ON chore_instances(child_id, date);
CREATE INDEX IF NOT EXISTS idx_chore_instances_status ON chore_instances(status, date);

-- ============================================
-- Notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'payday')),
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_child ON notifications(child_id, read);

-- ============================================
-- Weekly Rules (per parent)
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_rules (
  id TEXT PRIMARY KEY,
  parent_id TEXT UNIQUE NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  weekly_cap_points INTEGER DEFAULT 100,
  strict_mode INTEGER DEFAULT 1,
  grace_passes_per_month INTEGER DEFAULT 2,
  payday_day INTEGER DEFAULT 5,  -- 0=Sunday, 5=Friday
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- Rate Limiting table (for login attempts)
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,              -- e.g., "login:email@example.com" or "child:ABCD1234"
  attempts INTEGER DEFAULT 0,
  first_attempt TEXT DEFAULT (datetime('now')),
  locked_until TEXT,
  UNIQUE(key)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
