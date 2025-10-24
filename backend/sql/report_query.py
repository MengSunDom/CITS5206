
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
report_query.py - Produce CSV reports from analytics views (Week 6).
Usage:
  python report_query.py --db backend/db.sqlite3 --out-dir reports
"""
import argparse, os, sqlite3, csv

REPORTS = {
    'session_summary': 'SELECT * FROM vw_session_summary ORDER BY session_id;',
    'user_summary': 'SELECT * FROM vw_user_summary ORDER BY user_id;',
    'top_seats_per_session': 'SELECT * FROM vw_top_seats_per_session ORDER BY session_id, rn;'
}

def dump_query(conn, sql, out_path):
    cur = conn.execute(sql)
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(cols)
        w.writerows(rows)
    return len(rows)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', required=True, help='Path to SQLite database file')
    ap.add_argument('--out-dir', required=True, help='Directory to write CSV reports')
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    try:
        total = 0
        for name, sql in REPORTS.items():
            out_path = os.path.join(args.out_dir, f'{name}.csv')
            print(f'Writing {out_path} ...')
            n = dump_query(conn, sql, out_path)
            total += n
        print(f'Done. Rows exported: {total}')
    finally:
        conn.close()

if __name__ == '__main__':
    main()
