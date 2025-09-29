# API Test Report (Branch: New_GameBoard)

**Test Date:** 2025-09-29
**Test Script:** backend/test_api.py

---

## Summary
- **Total Test Cases:** 29
- **Passed:** 18
- **Failed:** 11
- **Pass Rate:** 62.07%

- Register-Weak-Password: PASS (400)
- Register-Missing-Email: PASS (400)
- Register-No-Plain-Password-In-Response: PASS (201)
- Login-Wrong-Password: PASS (400)
- Login-User-Not-Exist: PASS (400)
- Profile-Get: FAIL (401)
- Profile-Update: FAIL (401)
- Password-Reset-Confirm-Invalid: PASS (400)
- Password-Change: FAIL (401)

### Game
- Game-List-Sessions: FAIL (401)
## Actual Test Results

Register-Normal: PASS (status 201)
Register-Duplicate: PASS (status 400)
Register-Invalid-Email: PASS (status 400)
Register-Weak-Password: PASS (status 400)
Login-Normal: FAIL (status 200)
  Response: {'user': {'id': 10, 'username': 'johndoe', 'email': 'john@example.com', 'first_name': 'John', 'last_name': 'Doe', 'date_joined': '2025-09-29T05:53:08.530755Z', 'profile': {'display_name': '', 'preferred_system': '', 'timezone': 'UTC', 'bio': ''}}, 'tokens': {'refresh': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc1OTcyOTk4OSwiaWF0IjoxNzU5MTI1MTg5LCJqdGkiOiIzNWI5YTY2Y2NhMDc0YjI0YWQ3ODZlYjc2ODBmZTUzNyIsInVzZXJfaWQiOiIxMCJ9.euh2LNhmjvxnvl_eNkUQEBdhAF8XZ9kb96kHV1nP0As', 'access': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzU5MTI4Nzg5LCJpYXQiOjE3NTkxMjUxODksImp0aSI6IjQxMmNhOGYwODE0MjQ4MWM5ZmQyYTM2OTY2YWEzNjI3IiwidXNlcl9pZCI6IjEwIn0.mIk4HFJYJQy4pORIyk4v2QhJvTYALdwTzuXDV4r6CA0'}}
Login-Wrong-Password: PASS (status 400)
Login-User-Not-Exist: PASS (status 400)
Register-No-Plain-Password-In-Response: PASS (status 201)
Login-No-Plain-Password-In-Response: PASS (status 200)
Login-SQL-Injection-Protection: PASS (status 400)
Register-XSS-Injection-Protection: PASS (status 400)
Profile-Update-CSRF-Protection: FAIL (status 404)
  Response: [HTML 404 page]
Logout: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Profile-Get: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Profile-Update: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Password-Reset-Request: PASS (status 200)
Password-Reset-Confirm-Invalid: PASS (status 400)
Password-Change: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Token-Refresh: FAIL (status 400)
  Response: {'refresh': ['This field may not be null.']}
Profile-Get-No-Auth: PASS (status 401)
Game-Create-Session: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Game-List-Sessions: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Game-PlayerGames-List: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Register-Missing-Email: PASS (status 400)
Register-Password-Mismatch: PASS (status 400)
Login-Missing-Password: PASS (status 400)
Profile-Update-No-Auth: PASS (status 401)
Password-Change-Wrong-Old: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Token-Refresh-Invalid: PASS (status 401)
--- Test Report ---
Total cases: 29, Passed: 18, Pass rate: 62.07%

