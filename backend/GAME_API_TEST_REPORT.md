# Game API Automated Test Report

**Date:** 2025-09-16

## Overview
This report summarizes the actual results of automated API tests for the game module, including session management, bidding, deal creation, hand updates, player-game relations, and a variety of edge and error cases. The tests cover both normal user flows and abnormal/security scenarios.

## Actual Test Results

```
Game-Create-Session: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Game-List-Sessions: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Game-PlayerGames-List: FAIL (status 401)
  Response: {'detail': 'Given token not valid for any token type', ...}
Game-Create-Session-Missing-Partner: (not shown in output, likely not run due to auth fail)
Game-Create-Session-Self-Partner: (not shown in output, likely not run due to auth fail)
Game-Session-Make-Bid-Missing-Action: (not shown in output, likely not run due to auth fail)
Game-Session-Make-Call-Missing-Fields: (not shown in output, likely not run due to auth fail)
Game-Session-Update-Hands-No-Auth: (not shown in output, likely not run due to auth fail)
...

--- Test Report ---
Total cases: 29, Passed: 17, Pass rate: 58.62%
```
