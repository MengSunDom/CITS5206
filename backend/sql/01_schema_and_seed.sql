
-- Week 3 — Database Design & DDL + Basic DML (SQLite-compatible)
-- Enable FK constraints (SQLite requires this per-connection)
PRAGMA foreign_keys = ON;

-- =========================
-- Drop old tables if re-running (order matters due to FKs)
-- =========================
DROP TABLE IF EXISTS lab_bid;
DROP TABLE IF EXISTS lab_deal;
DROP TABLE IF EXISTS lab_session;
DROP TABLE IF EXISTS lab_profile;
DROP TABLE IF EXISTS lab_user;

-- =========================
-- Core entities
-- =========================

-- 1) Users
CREATE TABLE lab_user (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL UNIQUE,
    email       TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2) User profile (1-1 with user)
CREATE TABLE lab_profile (
    user_id     INTEGER PRIMARY KEY,
    full_name   TEXT NOT NULL,
    country     TEXT,
    bio         TEXT,
    FOREIGN KEY (user_id) REFERENCES lab_user(id) ON DELETE CASCADE
);

-- 3) Sessions (owner = user)
CREATE TABLE lab_session (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    owner_id    INTEGER NOT NULL,
    max_deals   INTEGER NOT NULL DEFAULT 16 CHECK (max_deals BETWEEN 1 AND 64),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (owner_id, name),
    FOREIGN KEY (owner_id) REFERENCES lab_user(id) ON DELETE CASCADE
);

-- 4) Deals (belong to a session)
CREATE TABLE lab_deal (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   INTEGER NOT NULL,
    deal_no      INTEGER NOT NULL CHECK (deal_no >= 1),
    dealer       TEXT NOT NULL CHECK (dealer IN ('N','E','S','W')),
    vulnerability TEXT NOT NULL CHECK (vulnerability IN ('None','NS','EW','All')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (session_id, deal_no),
    FOREIGN KEY (session_id) REFERENCES lab_session(id) ON DELETE CASCADE
);

-- 5) Bids (belong to a deal)
CREATE TABLE lab_bid (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id      INTEGER NOT NULL,
    sequence_no  INTEGER NOT NULL CHECK (sequence_no >= 1),
    seat         TEXT NOT NULL CHECK (seat IN ('N','E','S','W')),
    call         TEXT NOT NULL,  -- e.g., '1H','1S','1NT','PASS','X','XX'
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (deal_id, sequence_no),
    FOREIGN KEY (deal_id) REFERENCES lab_deal(id) ON DELETE CASCADE
);

-- =========================
-- Seed data
-- =========================

-- Users
INSERT INTO lab_user (username, email) VALUES
 ('alice', 'alice@example.com'),
 ('bob',   'bob@example.com'),
 ('charlie','charlie@example.com');

-- Profiles
INSERT INTO lab_profile (user_id, full_name, country, bio) VALUES
 (1, 'Alice Zhang',   'AU', 'Student / Bridge Enthusiast'),
 (2, 'Bob Li',        'CN', 'Backend Dev / Django'),
 (3, 'Charlie Wang',  'AU', 'Data Analyst / SQL lover');

-- Sessions (owner_id FK -> lab_user.id)
INSERT INTO lab_session (name, owner_id, max_deals) VALUES
 ('Practice Session A', 1, 8),
 ('Practice Session B', 2, 12);

-- Deals
INSERT INTO lab_deal (session_id, deal_no, dealer, vulnerability) VALUES
 (1, 1, 'N', 'None'),
 (1, 2, 'E', 'NS'),
 (1, 3, 'S', 'EW'),
 (1, 4, 'W', 'All'),
 (2, 1, 'N', 'None'),
 (2, 2, 'E', 'NS');

-- Bids for Session 1, Deal 1
INSERT INTO lab_bid (deal_id, sequence_no, seat, call) VALUES
 (1, 1, 'N', '1H'),
 (1, 2, 'E', 'PASS'),
 (1, 3, 'S', '2H'),
 (1, 4, 'W', 'PASS'),
 (1, 5, 'N', '4H'),
 (1, 6, 'E', 'PASS'),
 (1, 7, 'S', 'PASS'),
 (1, 8, 'W', 'PASS');

-- Bids for Session 1, Deal 2
INSERT INTO lab_bid (deal_id, sequence_no, seat, call) VALUES
 (2, 1, 'E', '1S'),
 (2, 2, 'S', 'X'),
 (2, 3, 'W', '2S'),
 (2, 4, 'N', 'PASS'),
 (2, 5, 'E', 'PASS'),
 (2, 6, 'S', 'PASS');

-- Simple DML examples
-- Update a user's email
UPDATE lab_user SET email = 'alice@uwa.edu.au' WHERE username = 'alice';

-- Delete a deal (to show ON DELETE CASCADE on bids)
-- (Uncomment to try) -- DELETE FROM lab_deal WHERE id = 2;

-- Basic SELECT checks
SELECT * FROM lab_user;
SELECT * FROM lab_session;
SELECT * FROM lab_deal;
SELECT * FROM lab_bid;
