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
- Description: Normal bidding sequence (1C, Pass, Pass, Pass)
- Result: PASS

### 2. test_illegal_bid
- Description: Repeated bid of 1C (illegal bid)
- Result: PASS

### 3. test_double_and_redouble
- Description: Double and redouble sequence (1C, Pass, X, Pass, XX)
- Result: FAIL
- Reason: Assertion self.state.dbl_status == 'XX', actual value is '', double/redouble status not updated correctly

### 4. test_passed_out
- Description: All players pass, no contract
- Result: PASS

### 5. test_wrong_turn
- Description: Wrong seat attempts to bid (turn order error)
- Result: PASS

---

## Analysis & Next Steps
- Most core bidding logic scenarios passed, overall logic is robust.
- Double/redouble sequence has implementation or test case issue, needs further investigation.
- Other bridge logic (dealing, scoring, etc.) can be further covered by unit tests.

---

## Resources & Links
- [Bridge Auction Validator](https://github.com/MengSunDom/CITS5206/blob/bridge-unit-test-report-20250929/backend/game/bridge_auction_validator.py)
- [Unit Test Script](https://github.com/MengSunDom/CITS5206/blob/bridge-unit-test-report-20250929/backend/game/tests.py)

> This report summarizes the results of core bridge auction logic unit tests. All resources are accessible for review and marking.
