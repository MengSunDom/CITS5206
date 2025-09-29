import requests

BASE_URL = 'http://127.0.0.1:8000/api/auth/'
GAME_BASE_URL = 'http://127.0.0.1:8000/api/game/'

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
    # 测试未带token访问 profile/update，后端应返回401/403
    resp = requests.put(BASE_URL + 'profile/update/', json=data)  # No token on purpose
    passed = resp.status_code in (401, 403)
    results.append(("Profile-Update-CSRF-Protection", passed, resp.status_code, resp.text))
    print(f"Profile-Update-CSRF-Protection: {'PASS' if passed else 'FAIL'} (status {resp.status_code})")
    if not passed:
        print('  Response:', resp.text)

def get_token(email, password):
    resp = requests.post(BASE_URL + 'login/', json={'email': email, 'password': password})
    try:
        data = resp.json()
        return data.get('access'), data.get('refresh')
    except Exception:
        return None, None

def get_auth_headers():
    access, _ = get_token('john@example.com', 'SecurePass123!')
    return {'Authorization': f'Bearer {access}'}

def test_logout():
    access, refresh = get_token('john@example.com', 'SecurePass123!')
    headers = {'Authorization': f'Bearer {access}'}
    resp = requests.post(BASE_URL + 'logout/', headers=headers, json={'refresh_token': refresh})
    assert_result('Logout', resp, 200)

def test_profile():
    access, _ = get_token('john@example.com', 'SecurePass123!')
    headers = {'Authorization': f'Bearer {access}'}
    resp = requests.get(BASE_URL + 'profile/', headers=headers)
    assert_result('Profile-Get', resp, 200, ['user'])

def test_profile_update():
    access, _ = get_token('john@example.com', 'SecurePass123!')
    headers = {'Authorization': f'Bearer {access}'}
    data = {'first_name': 'JohnUpdated', 'last_name': 'DoeUpdated'}
    resp = requests.put(BASE_URL + 'profile/update/', json=data, headers=headers)
    assert_result('Profile-Update', resp, 200)

def test_password_reset():
    data = {'email': 'john@example.com'}
    resp = requests.post(BASE_URL + 'password/reset/', json=data)
    assert_result('Password-Reset-Request', resp, 200)

def test_password_reset_confirm():
    # This requires a valid token from email, here just test 400 for missing/invalid
    data = {'token': 'invalid', 'password': 'NewPass123!', 'password2': 'NewPass123!'}
    resp = requests.post(BASE_URL + 'password/reset/confirm/', json=data)
    assert_result('Password-Reset-Confirm-Invalid', resp, 400)

def test_password_change():
    access, _ = get_token('john@example.com', 'SecurePass123!')
    headers = {'Authorization': f'Bearer {access}'}
    data = {'old_password': 'SecurePass123!', 'new_password': 'SecurePass456!', 'new_password2': 'SecurePass456!'}
    resp = requests.post(BASE_URL + 'password/change/', json=data, headers=headers)
    assert_result('Password-Change', resp, 200)

def test_token_refresh():
    _, refresh = get_token('john@example.com', 'SecurePass123!')
    data = {'refresh': refresh}
    resp = requests.post(BASE_URL + 'token/refresh/', json=data)
    assert_result('Token-Refresh', resp, 200, ['access'])

def test_profile_permission():
    # Try to get profile without token
    resp = requests.get(BASE_URL + 'profile/')
    assert_result('Profile-Get-No-Auth', resp, 401)

def test_create_session():
    headers = get_auth_headers()
    data = {
        'name': 'Test Session',
        'partner_email': 'secuser@example.com',
        'creator_position': 'N',
        'partner_position': 'S'
    }
    resp = requests.post(GAME_BASE_URL + 'sessions/', json=data, headers=headers)
    assert_result('Game-Create-Session', resp, 201, ['id'])
    session_id = resp.json().get('id') if resp.status_code == 201 else None
    return session_id

def test_create_session_missing_partner():
    headers = get_auth_headers()
    data = {
        'name': 'No Partner Session',
        'creator_position': 'N',
        'partner_position': 'S'
    }
    resp = requests.post(GAME_BASE_URL + 'sessions/', json=data, headers=headers)
    assert_result('Game-Create-Session-Missing-Partner', resp, 400)

def test_create_session_self_partner():
    headers = get_auth_headers()
    data = {
        'name': 'Self Partner Session',
        'partner_email': 'john@example.com',
        'creator_position': 'N',
        'partner_position': 'S'
    }
    resp = requests.post(GAME_BASE_URL + 'sessions/', json=data, headers=headers)
    assert_result('Game-Create-Session-Self-Partner', resp, 400)

def test_list_sessions():
    headers = get_auth_headers()
    resp = requests.get(GAME_BASE_URL + 'sessions/', headers=headers)
    assert_result('Game-List-Sessions', resp, 200)
    sessions = resp.json() if resp.status_code == 200 else []
    return sessions

def test_session_detail(session_id):
    headers = get_auth_headers()
    resp = requests.get(f"{GAME_BASE_URL}sessions/{session_id}/", headers=headers)
    assert_result('Game-Session-Detail', resp, 200, ['id'])

def test_make_bid(session_id):
    headers = get_auth_headers()
    data = {'bid_action': '1C'}
    resp = requests.post(f"{GAME_BASE_URL}sessions/{session_id}/make_bid/", json=data, headers=headers)
    assert_result('Game-Session-Make-Bid', resp, 200)

def test_make_bid_missing_action(session_id):
    headers = get_auth_headers()
    data = {}
    resp = requests.post(f"{GAME_BASE_URL}sessions/{session_id}/make_bid/", json=data, headers=headers)
    assert_result('Game-Session-Make-Bid-Missing-Action', resp, 400)

def test_bidding_history(session_id):
    headers = get_auth_headers()
    resp = requests.get(f"{GAME_BASE_URL}sessions/{session_id}/bidding_history/", headers=headers)
    assert_result('Game-Session-Bidding-History', resp, 200, ['bidding_history'])

def test_update_hands(session_id):
    headers = get_auth_headers()
    data = {'hands': {"N": ["AS", "KS"], "S": ["QS", "JS"]}}
    resp = requests.post(f"{GAME_BASE_URL}sessions/{session_id}/update_hands/", json=data, headers=headers)
    assert_result('Game-Session-Update-Hands', resp, 200)

def test_update_hands_no_auth(session_id):
    data = {'hands': {"N": ["AS"], "S": ["QS"]}}
    resp = requests.post(f"{GAME_BASE_URL}sessions/{session_id}/update_hands/", json=data)
    assert_result('Game-Session-Update-Hands-No-Auth', resp, 401)

def test_create_deal(session_id):
    headers = get_auth_headers()
    resp = requests.post(f"{GAME_BASE_URL}sessions/{session_id}/create_deal/", headers=headers)
    assert_result('Game-Session-Create-Deal', resp, 201, ['id'])
    deal_id = resp.json().get('id') if resp.status_code == 201 else None
    return deal_id

def test_current_deal(session_id):
    headers = get_auth_headers()
    resp = requests.get(f"{GAME_BASE_URL}sessions/{session_id}/current_deal/", headers=headers)
    assert_result('Game-Session-Current-Deal', resp, 200)

def test_make_call(session_id, deal_id):
    headers = get_auth_headers()
    data = {'session_id': session_id, 'deal_id': deal_id, 'call': '1D'}
    resp = requests.post(f"{GAME_BASE_URL}sessions/make_call/", json=data, headers=headers)
    assert_result('Game-Session-Make-Call', resp, 200)

def test_make_call_missing_fields():
    headers = get_auth_headers()
    data = {'session_id': 1}  # missing deal_id and call
    resp = requests.post(f"{GAME_BASE_URL}sessions/make_call/", json=data, headers=headers)
    assert_result('Game-Session-Make-Call-Missing-Fields', resp, 400)

def test_player_games():
    headers = get_auth_headers()
    resp = requests.get(GAME_BASE_URL + 'player-games/', headers=headers)
    assert_result('Game-PlayerGames-List', resp, 200)

def test_register_missing_fields():
    data = {
        'username': 'missingemail',
        'password': 'SomePass123!',
        'password2': 'SomePass123!'
    }
    resp = requests.post(BASE_URL + 'register/', json=data)
    assert_result('Register-Missing-Email', resp, 400)

def test_register_password_mismatch():
    data = {
        'username': 'mismatchuser',
        'email': 'mismatch@example.com',
        'password': 'SomePass123!',
        'password2': 'OtherPass123!'
    }
    resp = requests.post(BASE_URL + 'register/', json=data)
    assert_result('Register-Password-Mismatch', resp, 400)

def test_login_missing_fields():
    data = {'email': 'john@example.com'}  # missing password
    resp = requests.post(BASE_URL + 'login/', json=data)
    assert_result('Login-Missing-Password', resp, 400)

def test_profile_update_no_auth():
    data = {'first_name': 'NoAuth'}
    resp = requests.post(BASE_URL + 'profile/update/', json=data)
    assert_result('Profile-Update-No-Auth', resp, 401)

def test_password_change_wrong_old():
    access, _ = get_token('john@example.com', 'SecurePass123!')
    headers = {'Authorization': f'Bearer {access}'}
    data = {'old_password': 'WrongOldPass!', 'new_password': 'NewPass123!', 'new_password2': 'NewPass123!'}
    resp = requests.post(BASE_URL + 'password/change/', json=data, headers=headers)
    assert_result('Password-Change-Wrong-Old', resp, 400)

def test_token_refresh_invalid():
    data = {'refresh': 'invalidtoken'}
    resp = requests.post(BASE_URL + 'token/refresh/', json=data)
    assert_result('Token-Refresh-Invalid', resp, 401)

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
    test_logout()
    test_profile()
    test_profile_update()
    test_password_reset()
    test_password_reset_confirm()
    test_password_change()
    test_token_refresh()
    test_profile_permission()
    session_id = test_create_session()
    test_list_sessions()
    if session_id:
        test_session_detail(session_id)
        test_make_bid(session_id)
        test_bidding_history(session_id)
        test_update_hands(session_id)
        deal_id = test_create_deal(session_id)
        test_current_deal(session_id)
        if deal_id:
            test_make_call(session_id, deal_id)
        # 异常/边界用例
        test_create_session_missing_partner()
        test_create_session_self_partner()
        test_make_bid_missing_action(session_id)
        test_make_call_missing_fields()
        test_update_hands_no_auth(session_id)
    test_player_games()
    test_register_missing_fields()
    test_register_password_mismatch()
    test_login_missing_fields()
    test_profile_update_no_auth()
    test_password_change_wrong_old()
    test_token_refresh_invalid()
    print_report()
