# Development Setup Guide

## Quick Start for Developers

### 1. One-Command Setup (Recommended)

```bash
cd backend
python setup_dev.py
```

This will:
- Run all migrations
- Create a superuser (admin/admin)
- Create mock users for testing
- Set up a demo Bridge session

### 2. Manual Mock User Creation

#### Using Management Command

```bash
# Create mock users only
python manage.py create_mock_users

# Create mock users with a demo session
python manage.py create_mock_users --with-session

# Clear existing mock users and create fresh ones
python manage.py create_mock_users --clear --with-session
```

#### Using Django Shell

```python
python manage.py shell

from django.contrib.auth import get_user_model
User = get_user_model()

# Create users manually
alice = User.objects.create_user(
    username='alice',
    email='alice@example.com',
    password='TestPass123!'
)

bob = User.objects.create_user(
    username='bob',
    email='bob@example.com',
    password='TestPass123!'
)
```

## Test Accounts

After running the setup, you'll have these test accounts:

| Username | Email | Password | Description |
|----------|-------|----------|-------------|
| alice | alice@example.com | TestPass123! | Primary test user |
| bob | bob@example.com | TestPass123! | Secondary test user |
| charlie | charlie@example.com | TestPass123! | Additional user |
| diana | diana@example.com | TestPass123! | Additional user |
| admin | admin@example.com | admin | Django admin user |

## Testing the Application

### 1. Start the Backend

```bash
cd backend
python manage.py runserver
```

### 2. Start the Frontend

```bash
cd frontend
npm install  # First time only
npm start
```

### 3. Test Scenarios

#### Scenario 1: Create a New Session
1. Login as `alice`
2. Click "Create New Session"
3. Enter `bob@example.com` as partner email
4. Submit the form

#### Scenario 2: Join an Existing Session
1. Login as `bob`
2. You should see the session created by Alice
3. Click "Enter Session" to start bidding

#### Scenario 3: Test Bidding
1. Both users enter the same session
2. The dealer (North) makes the first bid
3. Players bid in clockwise order: N → E → S → W

## Database Management

### Reset Database

```bash
# Delete the database
rm db.sqlite3

# Recreate with migrations
python manage.py migrate

# Add mock data
python manage.py create_mock_users --with-session
```

### Export/Import Test Data

```bash
# Export current mock users
python manage.py dumpdata users.User --indent 2 > fixtures/users.json

# Import mock users on another machine
python manage.py loaddata fixtures/users.json
```

## Troubleshooting

### Issue: "User already exists"
**Solution:** Use the `--clear` flag to remove existing mock users
```bash
python manage.py create_mock_users --clear --with-session
```

### Issue: "Cannot create session"
**Solution:** Ensure both users exist in the database
```bash
python manage.py shell
from django.contrib.auth import get_user_model
User = get_user_model()
User.objects.filter(email__in=['alice@example.com', 'bob@example.com'])
```

### Issue: "Migration errors"
**Solution:** Reset migrations
```bash
python manage.py migrate users zero
python manage.py migrate game zero
python manage.py migrate
```

## API Testing

Use the built-in API documentation:
- Swagger UI: http://localhost:8000/api/docs/
- ReDoc: http://localhost:8000/api/redoc/

Or use curl:

```bash
# Get auth token
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"TestPass123!"}'

# Create a session (replace TOKEN with actual token)
curl -X POST http://localhost:8000/api/game/sessions/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Session","partner_email":"bob@example.com"}'
```