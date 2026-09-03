# Booking and Validation Contracts Implementation Plan

## Overview

Introduce the first durable test layer for booking, manager validation, and authorization risks identified in the project test strategy. The work adds fast Vitest contracts, makes manager capacity and time updates atomic at the database boundary, verifies Supabase guardrails with authenticated fixtures, and wires the resulting gates into the existing CI workflow.

## Current State Analysis

The repository has no test runner, test scripts, or test files. Booking writes already use an atomic `create_reservation` RPC and return stable application result objects, while manager class updates read reservations and then write classes through separate Supabase calls. Middleware, API routes, RLS, and security-definer functions provide layered authorization, but only tests against a real local Supabase instance can prove the database behavior.

The current `supabase/snippets/booking_contract_check.sql` predates the `auth.uid()` ownership guard and now invokes `create_reservation` without an authenticated session. It is not a valid regression gate for the latest schema.

## Desired End State

Developers have separate repeatable commands for fast unit/route tests and Docker-backed Supabase contracts. Unsafe reservation and manager mutations are rejected without persistence, authorization checks are exercised with real JWT identities, and CI requires both suites. The test-plan cookbook identifies canonical locations, reference tests, fixture rules, and commands for future additions.

### Key Discoveries

- `createReservation` is a narrow RPC adapter whose stable result mapping can be tested without a database (`src/lib/booking.handler.ts:63-92`).
- `normalizeLocalDateTime` is already public, while recurring-series validation can be tested through `createClass` without exporting private helpers (`src/lib/classes.mutation.handler.ts:126-256`).
- `updateClass` currently has a read-check-write race for both single classes and recurring series (`src/lib/classes.mutation.handler.ts:327-390`).
- The booking RPC locks the class row before checking capacity, providing the serialization pattern for manager updates (`supabase/migrations/20260830121000_enforce_cancelled_class_reservation_guard.sql:20-59`).
- RLS permits authenticated managers to update classes directly, so an RPC alone would not prevent bypassing capacity and time invariants (`supabase/migrations/20260630130000_admin_access_rls.sql:25-31`).
- Local Supabase runs on configured API and database ports and applies migrations plus `seed.sql` on reset (`supabase/config.toml`).
- The existing CI workflow targets `master` although this repository uses `main`, and it currently runs only lint and build (`.github/workflows/ci.yml`).

## What We're NOT Doing

- Adding Playwright, browser E2E scenarios, visual snapshots, or component rendering tests.
- Adding `jsdom`, Vitest UI, coverage thresholds, or a second JavaScript test framework.
- Expanding `BookingContractResult` with `AUTH_REQUIRED` or `FORBIDDEN`; those remain database contract outcomes.
- Testing every manager endpoint or every private helper.
- Changing reservation, class, or role product behavior beyond closing the manager update race.
- Using production Supabase credentials or mutable production data in tests.

## Implementation Approach

Use Vitest in a Node environment for application contracts. Keep unit and APIRoute tests under `src/`, and keep Docker-backed tests under `tests/contracts/` behind a separate command. The contract command resets local Supabase, creates a deterministic set of users through the local Auth Admin API, signs them in through the public Auth API, and runs files without parallelism so shared fixtures remain predictable.

Move manager updates to a security-definer RPC that locks all affected class rows in deterministic order before checking reservations and writing. Add a database-level update guard for capacity and start-time invariants so a manager cannot bypass the rule through direct table access still permitted by RLS. Preserve current result codes and single/series behavior.

## Critical Implementation Details

### Timing and Concurrency

The manager RPC must acquire the same class-row locks used by `create_reservation` before it counts confirmed reservations. For a series, lock target rows in stable order before any count or update; otherwise booking and series updates can deadlock or validate against stale state.

### Fixture Lifecycle

`test:contract` is intentionally destructive to the local Supabase database: it runs `supabase db reset` before Vitest. Fixed fixture accounts are then created through Auth Admin API and logged in normally so JWT, `auth.uid()`, profile triggers, RLS, and RPC checks remain real. Contract files run sequentially and must restore any shared class state they mutate.

## Phase 1: Vitest Foundation and Handler Contracts

### Overview

Establish the fast Node test loop and protect deterministic booking and class-validation behavior before changing persistence code.

### Changes Required

#### 1. Test Runner and Commands

**Files**: `package.json`, `package-lock.json`, `vitest.config.ts`

**Intent**: Add the smallest Vitest setup compatible with Astro's ESM TypeScript project and separate fast tests from local-Supabase contracts.

**Contract**: `npm test` runs `src/**/*.test.ts` once, `npm run test:watch` watches the same files, and `npm run test:contract` resets local Supabase before running `tests/contracts/**/*.test.ts` sequentially. The config uses a Node environment, resolves the existing `@/*` alias, restores mocks, and clears fake timers between tests.

#### 2. Booking Handler Contracts

**File**: `src/lib/booking.handler.test.ts`

**Intent**: Protect translation between Supabase RPC responses and the application's booking result union.

**Contract**: Cover valid success, malformed or missing success payloads, each public booking guardrail code, case-insensitive message extraction, unknown errors, and the exact `p_user_id`/`p_class_id` RPC arguments. Use a minimal typed RPC stub rather than mocking module internals.

#### 3. Class Validation and Mutation Contracts

**File**: `src/lib/classes.mutation.handler.test.ts`

**Intent**: Protect server-side date, payload, recurring-series, capacity, and start-time decisions at the public handler boundary.

**Contract**: Use fake time for malformed, impossible, exact-now, past, whitespace-padded, and valid local date values. Exercise `createClass` for invalid names, descriptions, capacities, and recurring ranges. Exercise `updateClass` with a fluent Supabase stub for capacity below confirmed reservations, locked start time, unchanged start time, non-recurring series requests, and a conflict in any series member. Every rejection asserts that no write method is reached.

### Success Criteria

#### Automated Verification

- Fast suite passes: `npm test`.
- Test files type-check with the project: `npx tsc --noEmit`.
- Test configuration and source pass lint: `npm run lint`.
- Production build remains valid: `npm run build`.

## Phase 2: Atomic Manager Mutation and Supabase Contracts

### Overview

Close the manager-update race and prove booking, persistence, ownership, role, and manager invariants against local Supabase.

### Changes Required

#### 1. Atomic Manager Update Boundary

**File**: `supabase/migrations/20260830150000_atomic_manager_class_updates.sql`

**Intent**: Make capacity and start-time safety authoritative in PostgreSQL and serialize manager updates with concurrent bookings.

**Contract**: Add a manager/admin-only security-definer RPC for single and following-series updates. It validates authentication and role, locks all affected class rows in deterministic order, preserves `CAPACITY_BELOW_RESERVATIONS`, `STARTS_AT_LOCKED`, `NOT_RECURRING`, and `SERIES_START_CHANGE_UNSUPPORTED`, and commits all affected rows or none. Add an update guard that enforces capacity not below confirmed reservations and forbids changing `starts_at` with confirmations even when an authenticated manager writes directly through PostgREST. Revoke public/anonymous execution and grant only the required authenticated roles.

#### 2. Manager Handler Integration

**File**: `src/lib/classes.mutation.handler.ts`

**Intent**: Route validated manager updates through the atomic database contract while preserving the existing public TypeScript result and UI codes.

**Contract**: `updateClass` retains UUID, payload, and local-date validation, invokes the new RPC once, maps known database outcomes to `ClassMutationResult`, and returns `DATABASE_ERROR` for unknown failures. Remove the stale application read-check-write path for update decisions; other class operations remain unchanged.

#### 3. Deterministic Local Supabase Fixtures

**Files**: `vitest.contract.config.ts`, `tests/contracts/support/local-supabase.ts`, `tests/contracts/support/fixtures.ts`

**Intent**: Provide stable authenticated clients and known class state without production secrets or order-dependent test residue.

**Contract**: The setup reads local endpoint keys from `supabase status`, creates fixed client A, client B, manager, and admin accounts through Auth Admin API after each database reset, promotes staff profiles through the service client, signs in role-scoped clients normally, and exposes stable fixture IDs. Contract execution is sequential and shared mutations are restored between cases.

#### 4. Reservation and Persistence Contracts

**File**: `tests/contracts/booking.contract.test.ts`

**Intent**: Prove that the real booking boundary creates exactly one valid confirmation and no confirmation for forbidden attempts.

**Contract**: Cover success, duplicate, full, started, cancelled, unauthenticated, and mismatched-owner calls. Assert stable RPC outcomes and reservation row counts after every attempt. Include a last-spot concurrent attempt that proves only one caller succeeds.

#### 5. Authorization and Manager Mutation Contracts

**Files**: `tests/contracts/access.contract.test.ts`, `tests/contracts/manager-class-update.contract.test.ts`

**Intent**: Prove reservation visibility, privileged class writes, direct-write protection, and atomic single/series manager updates.

**Contract**: Client A sees only its reservation, a client cannot write classes or call the manager RPC, and manager/admin identities can perform allowed operations. Unsafe direct table updates and unsafe RPC updates leave class rows unchanged. Safe single and series updates persist atomically, while a conflict in any target series member rolls back the entire operation.

#### 6. Obsolete Contract Check

**File**: `supabase/snippets/booking_contract_check.sql`

**Intent**: Remove the unauthenticated SQL check after equivalent authenticated Vitest contracts become canonical.

**Contract**: Delete the obsolete snippet; the cookbook points to `npm run test:contract` and the canonical contract files instead.

### Success Criteria

#### Automated Verification

- Database rebuild applies every migration and seed cleanly: `npx supabase db reset`.
- Supabase contract suite passes from a reset database: `npm run test:contract`.
- Fast regression suite still passes: `npm test`.
- Types, lint, and production build pass: `npx tsc --noEmit && npm run lint && npm run build`.

#### Manual Verification

- With local Supabase running, a manager can update a safe single class and safe following occurrences through the UI.
- With a confirmed reservation present, the manager UI reports the existing capacity/time rejection and persisted class data remains unchanged.

**Implementation Note**: Pause after automated verification for human confirmation of both manager UI scenarios before proceeding to Phase 3.

## Phase 3: HTTP Contracts and Quality Gates

### Overview

Protect the two selected server POST boundaries, require both suites in CI, and publish the final test conventions.

### Changes Required

#### 1. Reservation APIRoute Contracts

**File**: `src/pages/api/reservations/create.test.ts`

**Intent**: Protect form validation, safe return paths, authentication behavior, and booking-result redirects at the HTTP boundary.

**Contract**: Mock only imported Supabase/booking boundaries and use a small typed Astro context factory. Cover malformed class ID, unsafe `returnTo`, missing user, unavailable Supabase configuration, successful reservation, and a known booking rejection.

#### 2. Manager Update APIRoute Contracts

**File**: `src/pages/api/classes/[id]/update.test.ts`

**Intent**: Protect privileged-role rejection, form coercion, and mutation-result redirects for manager updates.

**Contract**: Cover unauthenticated, client, missing-role, manager, and admin contexts; verify capacity and `applyToSeries` coercion; verify `CONFIG_ERROR`, `UPDATED`, and known failure redirects. The route tests do not attempt to prove RLS or database atomicity.

#### 3. Continuous Integration Gates

**File**: `.github/workflows/ci.yml`

**Intent**: Make the required unit and focused-contract suites block pull requests and pushes on the repository's actual primary branch.

**Contract**: Correct workflow branch filters from `master` to `main`, run the fast suite after dependency/type generation, start local Supabase on the hosted runner, run the contract suite, and preserve lint/build checks. Contract CI uses only local Supabase credentials discovered at runtime, not repository secrets.

#### 4. Canonical Testing Documentation

**Files**: `context/foundation/test-plan.md`, `AGENTS.md`

**Intent**: Replace Phase 1 cookbook placeholders and the outdated no-test-runner guidance with executable project conventions.

**Contract**: Populate cookbook sections 6.1, 6.2, 6.4, and 6.5 with locations, naming, reference tests, commands, fixture/reset rules, and the rule that auth/RLS/RPC behavior is never replaced by mocks. Document `npm test`, `npm run test:watch`, and `npm run test:contract` in repository guidance. Leave the E2E placeholder and frozen strategy sections unchanged.

### Success Criteria

#### Automated Verification

- Both APIRoute test files pass as part of `npm test`.
- Full local quality sequence passes: `npm test && npm run test:contract && npx tsc --noEmit && npm run lint && npm run build`.
- CI workflow syntax remains valid and all existing steps are preserved.
- Cookbook no longer contains Phase 1 TBD entries in sections 6.1, 6.2, 6.4, or 6.5.

#### Manual Verification

- A pull request to `main` displays successful fast-test, Supabase-contract, lint, and build execution in GitHub Actions.

**Implementation Note**: Pause after local automated verification for human confirmation of the GitHub Actions run.

## Testing Strategy

### Unit Tests

- Test public handler behavior and observable write/no-write effects, not private implementation details.
- Freeze time for date-sensitive cases and restore real timers after each test.
- Stub only external Supabase call chains; do not duplicate production calculations inside expectations.
- Keep APIRoute tests limited to request/auth/coercion/redirect transport.

### Focused Contract Tests

- Reset local Supabase before the suite and use fixed fixture identities created through Auth Admin API.
- Authenticate normal clients through Auth API so JWT, `auth.uid()`, profile triggers, RLS, and RPC checks remain active.
- Assert both outcome codes and persisted state for every rejected write.
- Run contract files sequentially because they share deterministic fixture rows.
- Exercise direct PostgREST attempts as well as RPC calls where bypass resistance is part of the invariant.

### Manual Testing Steps

1. Start local Supabase and sign in as the fixed manager fixture.
2. Update a class without reservations and confirm the change persists.
3. Add a confirmed reservation, attempt to lower capacity or change time, and confirm the existing feedback appears with no persisted mutation.
4. Open a pull request to `main` and confirm every required CI check completes.

## Performance Considerations

Fast tests must remain independent of Docker and local network services. Contract tests may be slower because they reset Supabase, but fixed fixtures and sequential files prioritize determinism over parallel speed. The manager RPC should replace N application round trips for series validation with one database transaction; class locks must be held only for the validation and update transaction.

## Migration Notes

The new migration adds functions/triggers without rewriting existing rows. Rollback requires restoring the previous handler path before dropping the RPC and update guard; dropping the guard first would reopen the unsafe direct-write path. Apply and verify the migration on local Supabase before changing the handler call site.

## References

- Related research: `context/changes/testing-booking-validation-contracts/research.md`
- Test strategy: `context/foundation/test-plan.md`
- Booking RPC pattern: `supabase/migrations/20260830121000_enforce_cancelled_class_reservation_guard.sql`
- Manager mutation path: `src/lib/classes.mutation.handler.ts:327-390`
- RLS policies: `supabase/migrations/20260630130000_admin_access_rls.sql:6-61`
- Existing CI: `.github/workflows/ci.yml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Vitest Foundation and Handler Contracts

#### Automated

- [x] 1.1 Fast suite passes — 00542f9
- [x] 1.2 Test files type-check with the project — 00542f9
- [x] 1.3 Test configuration and source pass lint — 00542f9
- [x] 1.4 Production build remains valid — 00542f9

### Phase 2: Atomic Manager Mutation and Supabase Contracts

#### Automated

- [x] 2.1 Database rebuild applies every migration and seed cleanly — bf55653
- [x] 2.2 Supabase contract suite passes from a reset database — bf55653
- [x] 2.3 Fast regression suite still passes — bf55653
- [x] 2.4 Types, lint, and production build pass — bf55653

#### Manual

- [x] 2.5 Manager can update safe single and recurring classes — bf55653
- [x] 2.6 Unsafe manager updates show feedback and preserve persisted data — bf55653

### Phase 3: HTTP Contracts and Quality Gates

#### Automated

- [ ] 3.1 Both APIRoute test files pass as part of the fast suite
- [ ] 3.2 Full local quality sequence passes
- [ ] 3.3 CI workflow remains valid with existing checks preserved
- [ ] 3.4 Phase 1 cookbook entries are complete

#### Manual

- [ ] 3.5 Pull request to main passes every required CI check
