<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Booking Domain Foundation

- **Plan**: context/changes/booking-domain-foundation/plan.md
- **Mode**: Deep
- **Date**: 2026-06-30
- **Verdict**: REVISE (core approach sound; targeted fixes applied)
- **Findings**: 2 critical  3 warnings  2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | FAIL |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

6/7 paths (supabase/migrations/ missing — escalated to F3), 2/3 symbols (seed path claim incorrect — escalated to F6), brief↔plan ✓

## Findings

### F1 — Progress section malformed — blocks /10x-implement

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: ## Progress (line 111)
- **Detail**: Progress used 3 flat phase-level bullets instead of `### Phase N:` subsections with `#### Automated`/`#### Manual` and `- [ ] N.M <title>` items. `/10x-implement` cannot find the next pending step, flip checkboxes, or append SHAs.
- **Fix**: Reformat `## Progress` into proper subsections with per-step items derived from Exit Criteria bullets.
- **Decision**: FIXED — Progress reformatted with `### Phase N:` subsections, `#### Automated`/`#### Manual` subdivisions, and `- [ ] N.M <title>` items for all three phases.

### F2 — RLS policies absent for new booking tables

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — Define the booking schema
- **Detail**: AGENTS.md requires RLS on all new tables. Phase 1 adds `classes` and `reservations` with no mention of RLS, leaving data unprotected.
- **Fix B**: Defer RLS to a dedicated migration once F-02 (admin-access-foundation) lands; admin role policies depend on F-02's role column shape.
- **Decision**: FIXED via Fix B — explicit deferral documented in "What We're NOT Doing" section with note that a follow-up migration is required before production.

### F3 — supabase/migrations/ doesn't exist; plan omits creation step

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Define the booking schema
- **Detail**: Directory `supabase/migrations/` is absent. Phase 1 creates migration files there without noting the directory doesn't exist or how to create it.
- **Fix**: Add to Phase 1 scope: use `supabase migration new <name>` which creates the directory if absent.
- **Decision**: FIXED — Phase 1 scope updated to specify `supabase migration new`.

### F4 — Concurrent write atomicity mechanism unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Implement the booking contract
- **Detail**: "Atomic" write was promised but a TypeScript check-then-write is not atomic under concurrent requests. No mechanism named.
- **Fix A ⭐ Recommended**: PostgreSQL function `create_reservation` with `SELECT FOR UPDATE` called via Supabase RPC.
- **Decision**: FIXED via Fix A — Phase 2 scope updated to specify the PG function, RPC exposure, `SELECT FOR UPDATE`, and named exception codes.

### F5 — Schema tables, columns, and status enum not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Define the booking schema
- **Detail**: No table names, column names, types, or status enum values. Downstream slices could derive incompatible schema.
- **Fix A ⭐ Recommended**: Add Decisions section with canonical table/column/enum surface.
- **Decision**: FIXED via Fix A — `## Decisions` section added naming `classes`, `reservations`, column shapes, status enum values (`confirmed`/`cancelled`), and RPC function signature.

### F6 — seed.sql path already wired; plan incorrectly says it isn't

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Current State Analysis
- **Detail**: `config.toml` has `sql_paths = ["./seed.sql"]` — seed IS configured. Plan incorrectly stated it was not wired.
- **Fix**: Correct Current State Analysis and pin the path in Phase 1 scope.
- **Decision**: FIXED — Current State Analysis corrected; Phase 1 scope pins `supabase/seed.sql`.

### F7 — Phase 3 "targeted contract check" mechanism undefined

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Verify and hand off
- **Detail**: "Targeted contract check" named with no definition of what it is.
- **Fix**: Specify as a SQL script or Vitest test calling `create_reservation` and asserting all four cases.
- **Decision**: FIXED — Phase 3 scope updated to name the check mechanism and four cases.
