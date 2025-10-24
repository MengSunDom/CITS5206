
-- Week 4 — Queries, Views, Indexes, Window Functions & Triggers (SQLite-compatible)
PRAGMA foreign_keys = ON;

-- =========================
-- Helpful indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_lab_deal_session ON lab_deal(session_id);
CREATE INDEX IF NOT EXISTS idx_lab_bid_deal_seq ON lab_bid(deal_id, sequence_no);

-- =========================
-- 1) Sessions with counts of deals and bids
-- =========================
-- Uses LEFT JOIN + GROUP BY
SELECT
  s.id               AS session_id,
  s.name             AS session_name,
  u.username         AS owner,
  COUNT(DISTINCT d.id)              AS deal_count,
  COUNT(b.id)                       AS bid_count
FROM lab_session s
JOIN lab_user u       ON u.id = s.owner_id
LEFT JOIN lab_deal d  ON d.session_id = s.id
LEFT JOIN lab_bid b   ON b.deal_id = d.id
GROUP BY s.id, s.name, u.username
ORDER BY s.id;

-- =========================
-- 2) Bidding order with window function (ROW_NUMBER per deal)
-- =========================
-- Show first 4 bids in each deal, labeled with row numbers
WITH ordered AS (
  SELECT
    deal_id,
    sequence_no,
    seat,
    call,
    ROW_NUMBER() OVER (PARTITION BY deal_id ORDER BY sequence_no) AS rn
  FROM lab_bid
)
SELECT * FROM ordered WHERE rn <= 4 ORDER BY deal_id, rn;

-- =========================
-- 3) Average bids per deal per session
-- =========================
SELECT
  s.id AS session_id,
  s.name AS session_name,
  ROUND(AVG(bids_per_deal), 2) AS avg_bids_per_deal
FROM (
  SELECT d.session_id, d.id AS deal_id, COUNT(b.id) AS bids_per_deal
  FROM lab_deal d
  LEFT JOIN lab_bid b ON b.deal_id = d.id
  GROUP BY d.id
) t
JOIN lab_session s ON s.id = t.session_id
GROUP BY s.id, s.name
ORDER BY s.id;

-- =========================
-- 4) Deals that include at least one 'X' (Double) or 'XX' (Redouble)
-- =========================
SELECT
  d.id AS deal_id,
  d.session_id,
  SUM(CASE WHEN b.call IN ('X','XX') THEN 1 ELSE 0 END) AS doubles
FROM lab_deal d
LEFT JOIN lab_bid b ON b.deal_id = d.id
GROUP BY d.id, d.session_id
HAVING SUM(CASE WHEN b.call IN ('X','XX') THEN 1 ELSE 0 END) >= 1
ORDER BY d.id;

-- =========================
-- 5) Create a session summary VIEW
-- =========================
DROP VIEW IF EXISTS vw_session_summary;
CREATE VIEW vw_session_summary AS
SELECT
  s.id AS session_id,
  s.name AS session_name,
  u.username AS owner,
  COUNT(DISTINCT d.id) AS deal_count,
  COUNT(b.id) AS bid_count
FROM lab_session s
JOIN lab_user u ON u.id = s.owner_id
LEFT JOIN lab_deal d ON d.session_id = s.id
LEFT JOIN lab_bid b ON b.deal_id = d.id
GROUP BY s.id, s.name, u.username;

-- Quick check
SELECT * FROM vw_session_summary ORDER BY session_id;

-- =========================
-- 6) BEFORE INSERT trigger to enforce strictly increasing sequence_no per deal
--    New row's sequence_no must be max(sequence_no)+1 for that deal (or 1 if none)
-- =========================
DROP TRIGGER IF EXISTS trg_lab_bid_seq_enforce;
CREATE TRIGGER trg_lab_bid_seq_enforce
BEFORE INSERT ON lab_bid
FOR EACH ROW
BEGIN
  -- Determine expected next sequence number for this deal
  SELECT
    CASE
      WHEN NEW.sequence_no = COALESCE((SELECT MAX(sequence_no) FROM lab_bid WHERE deal_id = NEW.deal_id), 0) + 1
      THEN NULL  -- OK
      ELSE RAISE(ABORT, 'Sequence number must be consecutive starting at 1 per deal')
    END;
END;

-- Test the trigger (uncomment to test failing case)
-- INSERT INTO lab_bid (deal_id, sequence_no, seat, call) VALUES (1, 10, 'N', 'PASS'); -- should abort

-- =========================
-- 7) Simple parameter-like filters (examples you can adapt)
-- =========================
-- Deals for a given session_id
-- SELECT * FROM lab_deal WHERE session_id = :session_id ORDER BY deal_no;

-- Bids made by a specific seat across all deals
SELECT seat, COUNT(*) AS cnt
FROM lab_bid
GROUP BY seat
ORDER BY cnt DESC;

-- =========================
-- 8) Clean-up helpers (optional)
-- =========================
-- DELETE FROM lab_session WHERE name = 'Practice Session B';  -- cascades to deals & bids
-- UPDATE lab_profile SET country = 'AU' WHERE user_id = 2;

