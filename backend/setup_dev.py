#!/usr/bin/env python
"""
Development setup script for quick database initialization with test data.
Run this script to set up your development environment with mock users and data.
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth import get_user_model
from django.core.management import call_command

User = get_user_model()


def main():
    print("=" * 60)
    print("BRIDGE GAME - DEVELOPMENT SETUP")
    print("=" * 60)

    # Check if database needs migration
    print("\n1. Running database migrations...")
    try:
        call_command('migrate', verbosity=1)
        print("[OK] Migrations completed")
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        return

    # Create superuser if needed
    print("\n2. Checking for superuser...")
    if not User.objects.filter(is_superuser=True).exists():
        print("Creating superuser (admin/admin)...")
        User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='admin'
        )
        print("[OK] Superuser created: admin/admin")
    else:
        print("[OK] Superuser already exists")

    # Create mock users
    print("\n3. Creating mock users...")
    try:
        call_command('create_mock_users', '--with-session')
        print("[OK] Mock users created")
    except Exception as e:
        print(f"[ERROR] Failed to create mock users: {e}")

    print("\n" + "=" * 60)
    print("SETUP COMPLETE!")
    print("=" * 60)
    print("\nQuick Start:")
    print("1. Start backend:  cd backend && python manage.py runserver")
    print("2. Start frontend: cd frontend && npm start")
    print("\nTest Accounts:")
    print("  - alice@example.com / TestPass123!")
    print("  - bob@example.com / TestPass123!")
    print("  - Admin: admin / admin")
    print("\nAPI Documentation: http://localhost:8000/api/docs/")
    print("=" * 60)


if __name__ == '__main__':
    main()