# Booking and Validation Contracts - Plan Brief

> Full plan: `context/changes/testing-booking-validation-contracts/plan.md`
> Research: `context/changes/testing-booking-validation-contracts/research.md`

## What & Why

FitSpotApp needs its first durable test layer for the highest booking, manager-validation, and authorization risks. The plan adds fast application contracts and real local-Supabase checks, while closing the manager update race that would otherwise make the strongest test claim untrue under concurrency.

## Starting Point

Booking already uses an atomic PostgreSQL RPC, but there is no test runner or automated regression suite. Manager updates validate server-side through separate reads and writes, leaving capacity and time invariants open to concurrent booking changes.

## Desired End State

Developers can run fast Vitest checks separately from Docker-backed Supabase contracts. Both suites block CI, unsafe writes leave persistence unchanged, and future contributors have canonical examples for unit, database-contract, and APIRoute tests.

## Key Decisions Made

| Decision            | Choice                                                  | Why                                                                   | Source           |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- | ---------------- |
| Manager concurrency | Atomic database RPC plus direct-update guard            | Risk #2 requires a persistence guarantee, not an observed-state check | Research + Plan  |
| Test commands       | Separate fast and Supabase contract commands            | Keeps everyday feedback fast while making infrastructure explicit     | Plan             |
| HTTP coverage       | Test reservation and manager update APIRoutes           | User selected both request boundaries despite added mocking cost      | Plan             |
| Fixtures            | Fixed accounts and classes rebuilt after database reset | Predictable identities fit the existing local seed workflow           | Plan             |
| CI gates            | Require unit and contract suites                        | Honors the frozen quality gate in the test strategy                   | Test plan + Plan |
| Auth error codes    | Keep `AUTH_REQUIRED` and `FORBIDDEN` database-only      | Avoids expanding the user-facing booking result contract              | Research + Plan  |

## Scope

**In scope:**

- Vitest Node configuration and separate unit/watch/contract commands.
- Booking, class validation, manager mutation, and both selected APIRoute tests.
- Atomic single/series manager update enforcement in PostgreSQL.
- Authenticated local-Supabase fixtures and booking/RLS/role contracts.
- Existing CI workflow updates and Phase 1 cookbook documentation.

**Out of scope:**

- Playwright and the single E2E journey reserved for rollout Phase 2.
- DOM/component tests, snapshots, coverage thresholds, and Vitest UI.
- New public booking error codes or broad manager-endpoint coverage.
- Production Supabase data or credentials.

## Architecture / Approach

Fast Node tests exercise handlers and HTTP transport with narrow external stubs. Local-Supabase tests reset the database, create fixed identities through Auth Admin API, sign in normal clients, and verify RPC, RLS, concurrency, and persisted state. Manager writes move through a transaction that shares class-row locks with booking; a database guard also protects the invariant from direct PostgREST updates.

## Phases at a Glance

| Phase                  | What it delivers                                         | Key risk                                         |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| 1. Vitest foundation   | Fast handler contracts and stable test commands          | Brittle setup or tests coupled to internals      |
| 2. Atomic DB contracts | Safe manager mutation plus authenticated Supabase checks | Deadlocks, shared fixture state, migration drift |
| 3. HTTP and gates      | APIRoute coverage, CI enforcement, cookbook guidance     | Mock-heavy route tests or slow CI                |

**Prerequisites:** Node 22.14.0, Docker, and the repository's local Supabase CLI dependency.

**Estimated effort:** Approximately 3 focused sessions across 3 phases, plus one manual CI confirmation.

## Open Risks & Assumptions

- Series updates must lock rows in deterministic order before counting reservations.
- Fixed contract fixtures require a database reset and sequential execution.
- GitHub-hosted runners must have enough Docker capacity for local Supabase.
- Direct class updates remain available for other manager operations, so the database guard is required alongside the RPC.

## Success Criteria Summary

- Full, duplicate, started, cancelled, or unauthorized booking attempts create no reservation.
- Unsafe single or recurring manager updates cannot persist, including direct-table bypass attempts.
- `npm test`, `npm run test:contract`, lint, typecheck, build, and the corresponding CI workflow all pass.
