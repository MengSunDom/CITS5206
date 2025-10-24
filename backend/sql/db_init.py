
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
db_init.py - Initialize the lab schema and seed data for Week 3-5.
Usage:
  python db_init.py --db backend/db.sqlite3 --sql-dir backend/sql
"""
import argparse, os, sqlite3

def run_sql_file(conn, path):
    with open(path, 'r', encoding='utf-8') as f:
        sql = f.read()
    conn.executescript(sql)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', required=True, help='Path to SQLite database file')
    ap.add_argument('--sql-dir', required=True, help='Directory containing weekN.sql files')
    args = ap.parse_args()

    order = ['week3.sql', 'week4.sql', 'week5.sql']
    conn = sqlite3.connect(args.db)
    try:
        conn.execute('PRAGMA foreign_keys = ON;')
        for fname in order:
            fpath = os.path.join(args.sql_dir, fname)
            if not os.path.exists(fpath):
                raise FileNotFoundError(f"Missing required SQL file: {fpath}")
            print(f"Running {fname} ...")
            run_sql_file(conn, fpath)
        conn.commit()
        print('Initialization complete.')
    finally:
        conn.close()

if __name__ == '__main__':
    main()
