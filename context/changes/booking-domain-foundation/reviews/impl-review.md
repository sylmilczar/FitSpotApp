<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Booking Domain Foundation Implementation Plan

- **Plan**: context/changes/booking-domain-foundation/plan.md
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-08-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

## Evidence

- Reviewed plan commits: `4d334aa` (Phase 1), `5997027` (Phase 2), and `efaea26` (Phase 3).
- `npx supabase db reset`: PASS. All migrations and `supabase/seed.sql` applied successfully.
- `npm run lint && npm run build`: PASS.
- `npx supabase db query --file supabase/snippets/booking_contract_check.sql`: BLOCKED. Supabase CLI v2.108.0 submits the multi-statement script as one prepared statement and returns `cannot insert multiple commands into a prepared statement`.
- A direct local call to `create_reservation` returns `AUTH_REQUIRED`, as expected after `20260821120000_enforce_reservation_owner.sql`; the saved check's direct calls do not establish an authenticated JWT context.
- The original foundation's missing caller-ownership guard and `anon` execute grant were remediated by `20260821120000_enforce_reservation_owner.sql`. They are not active defects in the current migration chain.

## Findings

### F1 - Contract check is no longer executable after ownership hardening

- **Severity**: WARNING
- **Impact**: MEDIUM - real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: supabase/snippets/booking_contract_check.sql:4
- **Detail**: The Phase 3 SQL check calls `create_reservation` directly with synthetic user IDs. The later ownership migration now correctly requires `auth.uid()` to be present and equal to `p_user_id`, so each direct call returns `AUTH_REQUIRED` before the check can assert `ALREADY_RESERVED`, `CLASS_FULL`, or `CLASS_STARTED`. The installed Supabase CLI also cannot run its multi-statement transaction via `db query --file`. Consequently, the completed `3.2 Targeted contract check passes` marker cannot be reproduced against the current secure schema.
- **Fix A Recommended**: Update the SQL check to set an authenticated request context before every caller-specific RPC invocation, then run it through a file-capable local Postgres client in a documented command.
  - Strength: Preserves the original four-case database-level check while exercising the current ownership boundary.
  - Tradeoff: Requires careful test-only JWT claim setup and a documented local client invocation.
  - Confidence: HIGH - the direct RPC check proved the only blocker is the expected `AUTH_REQUIRED` guard.
  - Blind spot: The exact test-auth context helper supported by the local Supabase image has not been verified.
- **Fix B**: Replace the snippet with an integration test that invokes the RPC through authenticated Supabase clients.
  - Strength: Validates the same caller identity mechanism used by application code.
  - Tradeoff: Adds test-runner and local-service orchestration beyond the current SQL-only check.
  - Confidence: MEDIUM - no test runner is configured in this repository yet.
  - Blind spot: Test infrastructure choice has not been made.
- **Decision**: PENDING