import requests

BASE_URL = 'http://127.0.0.1:8000/api/auth/'

results = []

def assert_result(desc, resp, expect_status, expect_keys=None):
    try:
        data = resp.json()
    except Exception:
        data = resp.text
    passed = resp.status_code == expect_status
    if expect_keys and isinstance(data, dict):
        for k in expect_keys:
            if k not in data:
                passed = False
    results.append((desc, passed, resp.status_code, data))
    print(f"{desc}: {'PASS' if passed else 'FAIL'} (status {resp.status_code})")
    if not passed:
        print('  Response:', data)

def test_register_normal():
    data = {
        'username': 'johndoe',
        'email': 'john@example.com',
        'password': 'SecurePass123!',
        'password2': 'SecurePass123!',
        'first_name': 'John',
        'last_name': 'Doe'
    }
    resp = requests.post(BASE_URL + 'register/', json=data)
    assert_result('Register-Normal', resp, 201, ['user', 'tokens'])

def test_register_duplicate():
    data = {
        'username': 'johndoe',
        'email': 'john@example.com',
        'password': 'SecurePass123!',
        'password2': 'SecurePass123!',
        'first_name': 'John',
        'last_name': 'Doe'
    }
    resp = requests.post(BASE_URL + 'register/', json=data)
    assert_result('Register-Duplicate', resp, 400)

def test_register_invalid_email():
    data = {
        'username': 'user2',
        'email': 'not-an-email',
        'password': 'SecurePass123!',
        'password2': 'SecurePass123!',
        'first_name': 'Jane',
        'last_name': 'Smith'
    }
    resp = requests.post(BASE_URL + 'register/', json=data)
    assert_result('Register-Invalid-Email', resp, 400)

def test_register_weak_password():
    data = {
        'username': 'user3',
        'email': 'user3@example.com',
        'password': '123',
        'password2': '123',
        'first_name': 'Weak',
        'last_name': 'Pwd'
    }
    resp = requests.post(BASE_URL + 'register/', json=data)
    assert_result('Register-Weak-Password', resp, 400)

def test_login_normal():
    data = {
        'email': 'john@example.com',
        'password': 'SecurePass123!'
    }
    resp = requests.post(BASE_URL + 'login/', json=data)
    assert_result('Login-Normal', resp, 200, ['user', 'refresh', 'access'])

def test_login_wrong_password():
    data = {
        'email': 'john@example.com',
        'password': 'WrongPassword!'
    }
    resp = requests.post(BASE_URL + 'login/', json=data)
    assert_result('Login-Wrong-Password', resp, 400)

def test_login_not_exist():
    data = {
        'email': 'notexist@example.com',
        'password': 'AnyPassword123!'
    }
    resp = requests.post(BASE_URL + 'login/', json=data)
    assert_result('Login-User-Not-Exist', resp, 400)

def test_password_not_in_response():
    """Response of register and login should not contain plain password field"""
    data = {
        'username': 'secuser',
        'email': 'secuser@example.com',
        'password': 'SafePass123!',
        'password2': 'SafePass123!',
        'first_name': 'Sec',
        'last_name': 'User'
    }
    resp = requests.post(BASE_URL + 'register/', json=data)
    try:
        resp_json = resp.json()
    except Exception:
        resp_json = {}
    has_pwd = any('password' in str(v).lower() for v in resp_json.values()) if isinstance(resp_json, dict) else False
    passed = not has_pwd
    results.append(("Register-No-Plain-Password-In-Response", passed, resp.status_code, resp_json))
    print(f"Register-No-Plain-Password-In-Response: {'PASS' if passed else 'FAIL'} (status {resp.status_code})")
    if not passed:
        print('  Response:', resp_json)

    # Login
    data = {
        'email': 'secuser@example.com',
        'password': 'SafePass123!'
    }
    resp = requests.post(BASE_URL + 'login/', json=data)
    try:
        resp_json = resp.json()
    except Exception:
        resp_json = {}
    has_pwd = any('password' in str(v).lower() for v in resp_json.values()) if isinstance(resp_json, dict) else False
    passed = not has_pwd
    results.append(("Login-No-Plain-Password-In-Response", passed, resp.status_code, resp_json))
    print(f"Login-No-Plain-Password-In-Response: {'PASS' if passed else 'FAIL'} (status {resp.status_code})")
    if not passed:
        print('  Response:', resp_json)

def test_sql_injection():
    """Try SQL injection, should return 400/401, not 500"""
    data = {
        'email': "' OR 1=1 --@example.com",
        'password': 'any'
    }
    resp = requests.post(BASE_URL + 'login/', json=data)
    passed = resp.status_code in (400, 401)
    results.append(("Login-SQL-Injection-Protection", passed, resp.status_code, resp.text))
    print(f"Login-SQL-Injection-Protection: {'PASS' if passed else 'FAIL'} (status {resp.status_code})")
    if not passed:
        print('  Response:', resp.text)

def test_xss_injection():
    """Try XSS injection, response should not reflect malicious script"""
    data = {
        'username': '<script>alert(1)</script>',
        'email': 'xss@example.com',
        'password': 'XssPass123!',
        'password2': 'XssPass123!',
        'first_name': 'Xss',
        'last_name': 'Test'
    }
    resp = requests.post(BASE_URL + 'register/', json=data)
    try:
        resp_json = resp.json()
    except Exception:
        resp_json = {}
    reflected = '<script>' in str(resp_json)
    passed = not reflected
    results.append(("Register-XSS-Injection-Protection", passed, resp.status_code, resp_json))
    print(f"Register-XSS-Injection-Protection: {'PASS' if passed else 'FAIL'} (status {resp.status_code})")
    if not passed:
        print('  Response:', resp_json)

def test_csrf_protection():
    """Check CSRF protection, sensitive operation should be rejected without token (if CSRF middleware enabled)"""
    data = {'display_name': 'newname'}
    resp = requests.put(BASE_URL + '../profile/', json=data)  # No token on purpose
    passed = resp.status_code in (401, 403)
    results.append(("Profile-Update-CSRF-Protection", passed, resp.status_code, resp.text))
    print(f"Profile-Update-CSRF-Protection: {'PASS' if passed else 'FAIL'} (status {resp.status_code})")
    if not passed:
        print('  Response:', resp.text)

def print_report():
    print('\n--- Test Report ---')
    total = len(results)
    passed = sum(1 for r in results if r[1])
    print(f"Total cases: {total}, Passed: {passed}, Pass rate: {passed/total:.2%}")
    for desc, ok, status, data in results:
        print(f"{desc}: {'PASS' if ok else 'FAIL'} (status {status})")
        if not ok:
            print('  Response:', data)

if __name__ == '__main__':
    test_register_normal()
    test_register_duplicate()
    test_register_invalid_email()
    test_register_weak_password()
    test_login_normal()
    test_login_wrong_password()
    test_login_not_exist()
    test_password_not_in_response()
    test_sql_injection()
    test_xss_injection()
    test_csrf_protection()
    print_report()
