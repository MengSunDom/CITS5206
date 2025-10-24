
-- Week 5 — Advanced SQL: Audit Triggers + "Procedure-like" Session Clone (SQLite)
PRAGMA foreign_keys = ON;

-- =========================
-- A) Audit Logs (tables + triggers)
-- =========================
-- 记录对核心表的增删改，便于回溯与评分展示

CREATE TABLE IF NOT EXISTS lab_audit_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  session_id INTEGER,
  name TEXT,
  owner_id INTEGER,
  max_deals INTEGER,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_audit_deal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  deal_id INTEGER,
  session_id INTEGER,
  deal_no INTEGER,
  dealer TEXT,
  vulnerability TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_audit_bid (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  bid_id INTEGER,
  deal_id INTEGER,
  sequence_no INTEGER,
  seat TEXT,
  call TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions audit
DROP TRIGGER IF EXISTS trg_lab_session_ins_audit;
CREATE TRIGGER trg_lab_session_ins_audit
AFTER INSERT ON lab_session
FOR EACH ROW
BEGIN
  INSERT INTO lab_audit_session(action, session_id, name, owner_id, max_deals)
  VALUES ('INSERT', NEW.id, NEW.name, NEW.owner_id, NEW.max_deals);
END;

DROP TRIGGER IF EXISTS trg_lab_session_upd_audit;
CREATE TRIGGER trg_lab_session_upd_audit
AFTER UPDATE ON lab_session
FOR EACH ROW
BEGIN
  INSERT INTO lab_audit_session(action, session_id, name, owner_id, max_deals)
  VALUES ('UPDATE', NEW.id, NEW.name, NEW.owner_id, NEW.max_deals);
END;

DROP TRIGGER IF EXISTS trg_lab_session_del_audit;
CREATE TRIGGER trg_lab_session_del_audit
AFTER DELETE ON lab_session
FOR EACH ROW
BEGIN
  INSERT INTO lab_audit_session(action, session_id, name, owner_id, max_deals)
  VALUES ('DELETE', OLD.id, OLD.name, OLD.owner_id, OLD.max_deals);
END;

-- Deals audit
DROP TRIGGER IF EXISTS trg_lab_deal_ins_audit;
CREATE TRIGGER trg_lab_deal_ins_audit
AFTER INSERT ON lab_deal
FOR EACH ROW
BEGIN
  INSERT INTO lab_audit_deal(action, deal_id, session_id, deal_no, dealer, vulnerability)
  VALUES ('INSERT', NEW.id, NEW.session_id, NEW.deal_no, NEW.dealer, NEW.vulnerability);
END;

DROP TRIGGER IF EXISTS trg_lab_deal_upd_audit;
CREATE TRIGGER trg_lab_deal_upd_audit
AFTER UPDATE ON lab_deal
FOR EACH ROW
BEGIN
  INSERT INTO lab_audit_deal(action, deal_id, session_id, deal_no, dealer, vulnerability)
  VALUES ('UPDATE', NEW.id, NEW.session_id, NEW.deal_no, NEW.dealer, NEW.vulnerability);
END;

DROP TRIGGER IF EXISTS trg_lab_deal_del_audit;
CREATE TRIGGER trg_lab_deal_del_audit
AFTER DELETE ON lab_deal
FOR EACH ROW
BEGIN
  INSERT INTO lab_audit_deal(action, deal_id, session_id, deal_no, dealer, vulnerability)
  VALUES ('DELETE', OLD.id, OLD.session_id, OLD.deal_no, OLD.dealer, OLD.vulnerability);
END;

-- Bids audit
DROP TRIGGER IF EXISTS trg_lab_bid_ins_audit;
CREATE TRIGGER trg_lab_bid_ins_audit
AFTER INSERT ON lab_bid
FOR EACH ROW
BEGIN
  INSERT INTO lab_audit_bid(action, bid_id, deal_id, sequence_no, seat, call)
  VALUES ('INSERT', NEW.id, NEW.deal_id, NEW.sequence_no, NEW.seat, NEW.call);
END;

DROP TRIGGER IF EXISTS trg_lab_bid_upd_audit;
CREATE TRIGGER trg_lab_bid_upd_audit
AFTER UPDATE ON lab_bid
FOR EACH ROW
BEGIN
  INSERT INTO lab_audit_bid(action, bid_id, deal_id, sequence_no, seat, call)
  VALUES ('UPDATE', NEW.id, NEW.deal_id, NEW.sequence_no, NEW.seat, NEW.call);
END;

DROP TRIGGER IF EXISTS trg_lab_bid_del_audit;
CREATE TRIGGER trg_lab_bid_del_audit
AFTER DELETE ON lab_bid
FOR EACH ROW
BEGIN
  INSERT INTO lab_audit_bid(action, bid_id, deal_id, sequence_no, seat, call)
  VALUES ('DELETE', OLD.id, OLD.deal_id, OLD.sequence_no, OLD.seat, OLD.call);
END;

-- =========================
-- B) "Procedure-like" — Clone a whole Session (deals + bids)
-- =========================
-- 说明：SQLite 没有存储过程，这里用事务 + 临时参数表 + 映射表来实现。
-- 使用方法（示例见文末）：
-- 1) 将待克隆 session 的 id 和新名称写入 _params
-- 2) 运行该脚本，即可在同一 owner 下生成一份完整拷贝（包括 deals 与 bids）

-- 参数表（旧会话ID + 新名称）
DROP TABLE IF EXISTS _params;
CREATE TEMP TABLE _params (
  old_session_id INTEGER NOT NULL,
  new_name TEXT NOT NULL
);

-- 映射表（旧deal -> 新deal）
DROP TABLE IF EXISTS _deal_map;
CREATE TEMP TABLE _deal_map (
  old_deal_id INTEGER PRIMARY KEY,
  new_deal_id INTEGER NOT NULL
);

-- ========== 事务开始 ==========
BEGIN TRANSACTION;

-- 1) 创建新的 session（沿用原 owner 与 max_deals）
INSERT INTO lab_session (name, owner_id, max_deals)
SELECT p.new_name, s.owner_id, s.max_deals
FROM _params p
JOIN lab_session s ON s.id = p.old_session_id;

-- 2) 插入 deals 到新 session
INSERT INTO lab_deal (session_id, deal_no, dealer, vulnerability, created_at)
SELECT s_new.id, d.deal_no, d.dealer, d.vulnerability, d.created_at
FROM _params p
JOIN lab_session s_old ON s_old.id = p.old_session_id
JOIN lab_session s_new ON s_new.owner_id = s_old.owner_id AND s_new.name = p.new_name
JOIN lab_deal d ON d.session_id = s_old.id;

-- 3) 构建 deal 映射（通过 deal_no 对齐）
INSERT INTO _deal_map (old_deal_id, new_deal_id)
SELECT d_old.id AS old_deal_id, d_new.id AS new_deal_id
FROM _params p
JOIN lab_session s_old ON s_old.id = p.old_session_id
JOIN lab_session s_new ON s_new.owner_id = s_old.owner_id AND s_new.name = p.new_name
JOIN lab_deal d_old ON d_old.session_id = s_old.id
JOIN lab_deal d_new ON d_new.session_id = s_new.id AND d_new.deal_no = d_old.deal_no;

-- 4) 复制 bids（利用映射表）
INSERT INTO lab_bid (deal_id, sequence_no, seat, call, created_at)
SELECT m.new_deal_id, b.sequence_no, b.seat, b.call, b.created_at
FROM lab_bid b
JOIN _deal_map m ON m.old_deal_id = b.deal_id;

COMMIT;
-- ========== 事务结束 ==========

-- 输出克隆结果（新 session 的汇总）
SELECT * FROM vw_session_summary WHERE session_name IN (SELECT new_name FROM _params);

-- =========================
-- C) 额外：用户统计视图（便于 Week6 分析延展）
-- =========================
DROP VIEW IF EXISTS vw_user_summary;
CREATE VIEW vw_user_summary AS
SELECT u.id AS user_id,
       u.username,
       COUNT(DISTINCT s.id) AS total_sessions,
       COUNT(DISTINCT d.id) AS total_deals,
       COUNT(b.id) AS total_bids
FROM lab_user u
LEFT JOIN lab_session s ON s.owner_id = u.id
LEFT JOIN lab_deal d ON d.session_id = s.id
LEFT JOIN lab_bid b ON b.deal_id = d.id
GROUP BY u.id, u.username;

-- =========================
-- D) 使用示例（请按需取消注释）
-- =========================
-- -- 克隆 session 1 为一份新会话，命名为 'Practice Session A (Clone)'
-- DELETE FROM _params;
-- INSERT INTO _params VALUES (1, 'Practice Session A (Clone)');
-- -- 重新执行本文件（或从 BEGIN TRANSACTION 处开始执行到 COMMIT）
-- -- 检查结果：
-- SELECT * FROM vw_session_summary WHERE session_name LIKE '%Clone%';
-- SELECT * FROM lab_audit_session ORDER BY id DESC LIMIT 10;
-- SELECT * FROM lab_audit_deal ORDER BY id DESC LIMIT 10;
-- SELECT * FROM lab_audit_bid ORDER BY id DESC LIMIT 10;
