
# DB Tasks

---

## 3. Audit Triggers and Session Cloning
- **File:** `03_audit_and_clone.sql`
- **Functions:**
  - **Audit Logs:** Automatically record `INSERT`, `UPDATE`, and `DELETE` operations 
    on `lab_session`, `lab_deal`, and `lab_bid` tables into `lab_audit_*` tables.
  - **Session Cloning:** (procedure-like simulation) Clone one session together with 
    all related deals and bids into a new session.
- **Execution Order:** Run `01_schema_and_seed.sql` and `02_queries_views_triggers.sql` first, 
  then execute `03_audit_and_clone.sql`.

### Example in dbshell or sqlite3
```sql
.read backend/sql/03_audit_and_clone.sql        -- Create triggers and views
DELETE FROM _params;
INSERT INTO _params VALUES (1, 'Practice Session A (Clone)');
.read backend/sql/03_audit_and_clone.sql        -- Run again to perform cloning
SELECT * FROM vw_session_summary WHERE session_name LIKE '%Clone%';
```

---

## 4. Analytics & Reports
- **File:** `04_reporting_analytics.sql`
- **Features:**
  - Top-N seat activity analysis
  - Bid distribution (%) per session
  - Session intensity (Z-score)
  - Rolling bid sequence using `LAG()`
  - Recursive CTE to fill missing dates
  - Generate report tables `rpt_session_summary`, `rpt_user_summary`, 
    and dashboard view `vw_top_seats_per_session`.
- **Usage:**
```bash
sqlite3 backend/db.sqlite3 < backend/sql/04_reporting_analytics.sql
```

---

## 5. Python Integration
- **Files:** `db_init.py`, `report_query.py`, `run_reports.sh`, `run_reports.bat`
- **Functions:**
  - `db_init.py`: Sequentially execute `01_schema_and_seed.sql`, `02_queries_views_triggers.sql`, 
    and `03_audit_and_clone.sql` to initialize the database.
  - `report_query.py`: Export CSV reports (`session_summary.csv`, `user_summary.csv`, `top_seats_per_session.csv`) 
    from analytical views.
  - `run_reports.*`: One-click scripts to initialize, run analytics, and export reports.
- **One-Click Execution:**
```bash
# macOS/Linux
bash backend/sql/run_reports.sh

# Windows
backend\sql\run_reports.bat
```

> **Note:** Place all scripts inside `backend/sql/` and make sure **SQLite3** and **Python 3** are installed.
