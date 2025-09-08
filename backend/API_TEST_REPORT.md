# API Automated Test Report

**Date:** 2025-09-08

## Overview
This report summarizes the results of automated API tests for user registration, login, and security-related flows in the backend service. The tests cover normal and abnormal user scenarios, as well as security checks such as SQL injection, XSS, and CSRF protection.

## Test Cases
- Register-Normal
- Register-Duplicate
- Register-Invalid-Email
- Register-Weak-Password
- Login-Normal
- Login-Wrong-Password
- Login-User-Not-Exist
- Register-No-Plain-Password-In-Response
- Login-No-Plain-Password-In-Response
- Login-SQL-Injection-Protection
- Register-XSS-Injection-Protection
- Profile-Update-CSRF-Protection

## How to Reproduce
1. Make sure the backend server is running at `http://127.0.0.1:8000`.
2. Install dependencies: `pip install requests`
3. Run the test script: `python backend/test_api.py`

## Example Output
```
--- Test Report ---
Total cases: 12, Passed: 12, Pass rate: 100.00%
Register-Normal: PASS (status 201)
Register-Duplicate: PASS (status 400)
Register-Invalid-Email: PASS (status 400)
Register-Weak-Password: PASS (status 400)
Login-Normal: PASS (status 200)
Login-Wrong-Password: PASS (status 400)
Login-User-Not-Exist: PASS (status 400)
Register-No-Plain-Password-In-Response: PASS (status 201)
Login-No-Plain-Password-In-Response: PASS (status 200)
Login-SQL-Injection-Protection: PASS (status 400)
Register-XSS-Injection-Protection: PASS (status 201)
Profile-Update-CSRF-Protection: PASS (status 403)
```

## Notes
- All test case names and report content are in English for international team collaboration.
- If any test fails, the response details will be shown in the output for debugging.
- The test script can be extended for more endpoints and scenarios as needed.

---

*This report is auto-generated for QA and development team collaboration.*
