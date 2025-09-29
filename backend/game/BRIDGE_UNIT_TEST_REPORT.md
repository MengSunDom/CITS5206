# Bridge Auction Logic Unit Test Report

**Test Date:** 2025-09-29
**Test Target:** backend/game/bridge_auction_validator.py
**Test Script:** backend/game/tests.py

---

## Summary
- **Total Test Cases:** 5
- **Passed:** 4
- **Failed:** 1
- **Pass Rate:** 80%

---

## Test Details

### 1. test_valid_bid_sequence
- 测试内容：正常叫牌流程（1C, Pass, Pass, Pass）
- 结果：PASS

### 2. test_illegal_bid
- 测试内容：重复叫同样的1C（非法叫牌）
- 结果：PASS

### 3. test_double_and_redouble
- 测试内容：加倍与再加倍流程（1C, Pass, X, Pass, XX）
- 结果：FAIL
- 失败原因：断言 self.state.dbl_status == 'XX'，实际为 ''，加倍/再加倍状态未正确更新

### 4. test_passed_out
- 测试内容：全员Pass，无合约
- 结果：PASS

### 5. test_wrong_turn
- 测试内容：非轮到座位叫牌（错误顺序）
- 结果：PASS

---

## Analysis & Next Steps
- 核心叫牌算法大部分场景通过，业务逻辑健壮。
- 加倍/再加倍流程存在实现或测试用例细节问题，建议进一步排查。
- 其他业务逻辑（发牌、胜负判定等）可继续补充单元测试。

---

## Resources & Links
- [Bridge Auction Validator](https://github.com/MengSunDom/CITS5206/blob/qa-api-test-20250929/backend/game/bridge_auction_validator.py)
- [Unit Test Script](https://github.com/MengSunDom/CITS5206/blob/qa-api-test-20250929/backend/game/tests.py)

> This report summarizes the results of core bridge auction logic unit tests. All resources are accessible for review and marking.
