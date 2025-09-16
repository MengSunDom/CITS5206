# User API Automated Test Report

**Date:** 2025-09-16

## Overview
This report summarizes the actual results of automated API tests for the user module, including registration, login, logout, profile management, password operations, token refresh, permission checks, and a variety of edge and error cases. The tests cover both normal user flows and abnormal/security scenarios.

## Actual Test Results

```
Register-Normal: FAIL (status 400)
  Response: {'username': ['A user with that username already exists.'], 'email': ['User with this email already exists.']}
Register-Duplicate: PASS (status 400)
Register-Invalid-Email: PASS (status 400)
Register-Weak-Password: PASS (status 400)
Login-Normal: FAIL (status 200)
  Response: {'user': {'id': 9, 'username': 'johndoe', 'email': 'john@example.com', 'first_name': 'John', 'last_name': 'Doe', 'date_joined': '2025-09-15T20:13:45.384331Z', 'profile': {'display_name': '', 'preferred_system': '', 'timezone': 'UTC', 'bio': ''}}, 'tokens': {...}}
Login-Wrong-Password: PASS (status 400)
Login-User-Not-Exist: PASS (status 400)
Register-No-Plain-Password-In-Response: PASS (status 400)
Login-No-Plain-Password-In-Response: PASS (status 200)
Login-SQL-Injection-Protection: PASS (status 400)
Register-XSS-Injection-Protection: PASS (status 400)
Profile-Update-CSRF-Protection: FAIL (status 404)
  Response: (Django 404 HTML page)
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
Register-Missing-Email: PASS (status 400)
Register-Password-Mismatch: PASS (status 400)
Login-Missing-Password: PASS (status 400)
Profile-Update-No-Auth: PASS (status 401)
Password-Change-Wrong-Old: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Token-Refresh-Invalid: PASS (status 401)

--- Test Report ---
Total cases: 29, Passed: 17, Pass rate: 58.62%
```
