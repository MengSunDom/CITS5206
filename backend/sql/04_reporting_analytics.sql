
-- Week 6 - Analytics & Reports (SQLite)
PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_lab_bid_seat ON lab_bid(seat);
CREATE INDEX IF NOT EXISTS idx_lab_session_owner ON lab_session(owner_id);

-- 1) Top-N: most active seats overall
WITH seat_counts AS (
  SELECT seat, COUNT(*) AS cnt
  FROM lab_bid
  GROUP BY seat
)
SELECT seat, cnt
FROM seat_counts
ORDER BY cnt DESC, seat ASC
LIMIT 3;

-- 1b) Per-session top 2 seats
WITH per_session AS (
  SELECT s.id AS session_id, s.name AS session_name, b.seat, COUNT(*) AS bid_count
  FROM lab_session s
  JOIN lab_deal d ON d.session_id = s.id
  JOIN lab_bid b  ON b.deal_id = d.id
  GROUP BY s.id, s.name, b.seat
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY bid_count DESC, seat) AS rn
  FROM per_session
)
SELECT session_id, session_name, seat, bid_count
FROM ranked
WHERE rn <= 2
ORDER BY session_id, rn;

-- 2) Share of bids per deal within its session (percent)
WITH deal_bids AS (
  SELECT d.id AS deal_id, d.session_id, COUNT(b.id) AS bids_per_deal
  FROM lab_deal d
  LEFT JOIN lab_bid b ON b.deal_id = d.id
  GROUP BY d.id
),
session_totals AS (
  SELECT session_id, SUM(bids_per_deal) AS total_bids_in_session
  FROM deal_bids
  GROUP BY session_id
)
SELECT
  d.session_id,
  d.deal_id,
  d.bids_per_deal,
  t.total_bids_in_session,
  ROUND(100.0 * d.bids_per_deal / NULLIF(t.total_bids_in_session,0), 1) AS percent_of_session
FROM deal_bids d
JOIN session_totals t USING (session_id)
ORDER BY d.session_id, d.deal_id;

-- 3) Session intensity score (z-score across sessions)
WITH session_bid_counts AS (
  SELECT s.id AS session_id, s.name AS session_name, COUNT(b.id) AS bid_count
  FROM lab_session s
  LEFT JOIN lab_deal d ON d.session_id = s.id
  LEFT JOIN lab_bid b  ON b.deal_id = d.id
  GROUP BY s.id, s.name
),
stats AS (
  SELECT
    AVG(bid_count) AS mean_cnt,
    sqrt(AVG(bid_count * 1.0 * bid_count) - AVG(bid_count * 1.0) * AVG(bid_count * 1.0)) AS std_cnt
  FROM session_bid_counts
)
SELECT
  s.session_id,
  s.session_name,
  s.bid_count,
  ROUND((s.bid_count - stats.mean_cnt) / NULLIF(stats.std_cnt,0), 3) AS z_score
FROM session_bid_counts s, stats
ORDER BY z_score DESC;

-- 4) Rolling window per deal using LAG
SELECT
  deal_id,
  sequence_no,
  seat,
  call,
  LAG(call, 1) OVER (PARTITION BY deal_id ORDER BY sequence_no) AS prev_call_1,
  LAG(call, 2) OVER (PARTITION BY deal_id ORDER BY sequence_no) AS prev_call_2
FROM lab_bid
ORDER BY deal_id, sequence_no;

-- 5) Daily activity series (recursive CTE to fill gaps)
WITH bounds AS (
  SELECT DATE(MIN(created_at)) AS start_date,
         DATE(MAX(created_at)) AS end_date
  FROM lab_bid
),
dates(start_date, end_date, d) AS (
  SELECT start_date, end_date, start_date FROM bounds
  UNION ALL
  SELECT start_date, end_date, DATE(d, '+1 day') FROM dates
  WHERE d < end_date
),
by_day AS (
  SELECT DATE(created_at) AS d, COUNT(*) AS bids
  FROM lab_bid
  GROUP BY DATE(created_at)
)
SELECT d AS date, COALESCE(b.bids, 0) AS bids
FROM dates
LEFT JOIN by_day b ON b.d = dates.d
ORDER BY date;

-- 6) Materialize report tables (optional rebuild)
DROP TABLE IF EXISTS rpt_session_summary;
CREATE TABLE rpt_session_summary AS
SELECT * FROM vw_session_summary;

DROP TABLE IF EXISTS rpt_user_summary;
CREATE TABLE rpt_user_summary AS
SELECT * FROM vw_user_summary;

-- 7) Convenience dashboard view
DROP VIEW IF EXISTS vw_top_seats_per_session;
CREATE VIEW vw_top_seats_per_session AS
WITH per_session AS (
  SELECT s.id AS session_id, s.name AS session_name, b.seat, COUNT(*) AS bid_count
  FROM lab_session s
  JOIN lab_deal d ON d.session_id = s.id
  JOIN lab_bid b  ON b.deal_id = d.id
  GROUP BY s.id, s.name, b.seat
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY bid_count DESC, seat) AS rn
  FROM per_session
)
SELECT * FROM ranked WHERE rn <= 2;

-- Checks
SELECT * FROM rpt_session_summary ORDER BY session_id;
SELECT * FROM rpt_user_summary ORDER BY user_id;
SELECT * FROM vw_top_seats_per_session ORDER BY session_id, rn;
