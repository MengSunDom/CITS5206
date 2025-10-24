
#!/usr/bin/env bash
set -euo pipefail
DB_PATH="backend/db.sqlite3"
SQL_DIR="backend/sql"
OUT_DIR="reports"

python3 db_init.py --db "$DB_PATH" --sql-dir "$SQL_DIR"
sqlite3 "$DB_PATH" < "$SQL_DIR/week6.sql"
python3 report_query.py --db "$DB_PATH" --out-dir "$OUT_DIR"
echo "Reports generated under $OUT_DIR/"
