<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Manager Manage Classes and Attendees

- **Plan**: `context/changes/manager-manage-classes-and-attendees/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-21
- **Verdict**: SOUND
- **Findings**: [3 critical] [2 warnings] [0 observations]

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding
Grounding: 7/7 paths ✓, 7/7 symbols ✓, brief↔plan ✓. No `lessons.md` or `contract-surfaces.md` found.

## Findings

### F1 — Public read models are not fully covered by the status migration

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully about migration ordering
- **Dimension**: End-State Alignment
- **Location**: Phase 1 — Class status migration
- **Detail**: The original review assumed cancelled classes should disappear from `/classes`. The product decision is now the opposite: cancelled classes must remain visible so previously registered users understand what happened.
- **Fix**: Reframe the public read-model contract to return class status and render `CANCELLED` while disabling reservation actions.
- **Decision**: DISMISSED as misframed; the plan now reflects the intended product behavior.

### F2 — Attendee email projection has no safe data source contract

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully about auth data access
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Attendee read model
- **Detail**: The plan required user email without specifying a safe public-schema projection or auth.users access model.
- **Fix**: Add an additive `profiles.email` projection, backfill existing rows, update signup trigger, and make attendee RPC join profiles.
- **Decision**: FIXED

### F3 — Cancelled classes remain reservable through the existing RPC

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully about domain invariants
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Class Management Handlers and Validation
- **Detail**: Existing `create_reservation()` does not check class status, so direct callers could reserve a soft-cancelled class.
- **Fix**: Add `CLASS_CANCELLED` guard to a new migration, extend shared types/UI mapping, and verify direct RPC rejection.
- **Decision**: FIXED

### F4 — Local datetime-to-UTC conversion is underspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Validation schemas and form normalization
- **Detail**: Browser-local `datetime-local` input lacked a deterministic conversion and stable future-date validation contract.
- **Fix**: Define shared normalization returning UTC ISO or `INVALID_FORMAT`/`PAST_DATE`; server validation is authoritative.
- **Decision**: FIXED

### F5 — Manager route constants are referenced but not scheduled as a concrete change

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Routing constants and middleware
- **Detail**: The plan referenced manager routes without naming the exact symbols or replacing the hardcoded middleware route list.
- **Fix**: Define `MANAGER_ROUTE`, `MANAGER_CLASSES_ROUTE`, and a shared privileged route guard covering `/manager` and `/admin`.
- **Decision**: FIXED
