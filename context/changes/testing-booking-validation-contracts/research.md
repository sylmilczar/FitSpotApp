---
date: 2026-08-30T12:51:41+02:00
researcher: GitHub Copilot
git_commit: e79e281313cf0e2dc476e7222bc0e6515fccdae9
branch: M3L1_tests
repository: FitSpotApp
topic: "Phase 1: unit booking and validation contracts"
tags: [research, codebase, booking, validation, authorization, vitest, supabase]
status: complete
last_updated: 2026-08-30
last_updated_by: GitHub Copilot
---

# Research: Phase 1 Unit Booking and Validation Contracts

**Date**: 2026-08-30T12:51:41+02:00
**Researcher**: GitHub Copilot
**Git Commit**: e79e281313cf0e2dc476e7222bc0e6515fccdae9
**Branch**: M3L1_tests
**Repository**: FitSpotApp

## Research Question

For Phase 1 of the test rollout, where are the real enforcement and persistence boundaries for booking guardrails, manager class validation, reservation ownership, and privileged access, and which unit or focused contract tests provide the cheapest reliable signal for risks #1-#4 in [the test plan](../../foundation/test-plan.md)?

## Summary

Phase 1 needs two complementary test layers. Node-based Vitest tests should cover deterministic application contracts: booking RPC result mapping, date normalization, payload validation, manager capacity/time decisions, and API authorization/redirect behavior. Focused tests against local Supabase must cover the rules whose truth lives in PostgreSQL: atomic booking guardrails, reservation ownership, row-level visibility, and privileged writes.

The booking write is well protected. `create_reservation` locks the class row, checks cancelled/started/duplicate/full conditions, then inserts exactly one confirmed reservation in the same transaction. The application translates the RPC exception message into a stable result code, but this translation is coupled to message text and does not currently expose `AUTH_REQUIRED` or `FORBIDDEN` as booking result codes.

Manager validation is server-side, not merely browser-side. `updateClass` rejects capacity below confirmed reservations and locks a class start time when confirmed reservations exist. However, its read-check-write sequence is not atomic, so an application-level test can characterize current behavior but cannot prove safety under concurrent writes. This is the main architectural gap surfaced by the research.

Authorization is intentionally layered: middleware and API routes fail fast, while RLS and security-definer RPC checks are authoritative. Mock-only tests cannot prove those database guarantees.

## Detailed Findings

### Booking Guardrails and Persistence

The reservation form posts only `classId` and `returnTo`. The API validates the identifier, requires an authenticated user, creates the cookie-bound Supabase client, and passes the authenticated user's ID to the booking handler ([reservation API](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/pages/api/reservations/create.ts#L28-L61)). A successful handler result becomes `reserveResult=RESERVED`; failures preserve the stable guardrail code in the redirect.

`createReservation` is a thin application contract over `supabase.rpc("create_reservation")`. It returns `{ ok: true }` only for an object with `ok: true`; RPC errors are mapped to `CLASS_FULL`, `ALREADY_RESERVED`, `CLASS_STARTED`, `CLASS_CANCELLED`, or `UNKNOWN` by matching the exception message ([booking handler](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/lib/booking.handler.ts#L4-L15), [RPC result mapping](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/lib/booking.handler.ts#L63-L92)). The cheapest unit tests should inject a minimal Supabase-shaped stub and assert every known error, unknown errors, malformed success data, and valid success data.

The authoritative write contract is the latest `create_reservation` function. It:

- rejects a missing session and a mismatched `p_user_id` before reading class state;
- locks the selected class row with `FOR UPDATE`;
- rejects cancelled and started classes;
- rejects an existing confirmed reservation;
- counts confirmed reservations and rejects a full class;
- inserts a confirmed reservation only after every guard passes.

These behaviors are in the same database transaction ([reservation RPC](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/supabase/migrations/20260830121000_enforce_cancelled_class_reservation_guard.sql#L1-L62)). Focused local-Supabase tests should assert both the returned error code and persisted state: zero new rows for each rejection, one confirmed row for success, and no second row after a duplicate attempt. The class-row lock makes a capacity race test meaningful at this boundary.

### Manager Validation and Mutation Safety

The manager update endpoint repeats the privileged-role check, converts form values into `UpdateClassInput`, and delegates to `updateClass` ([manager update API](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/pages/api/classes/%5Bid%5D/update.ts#L12-L39)). This is a useful route-level contract seam for unauthenticated/client-role rejection and form coercion, but it is not the authoritative authorization boundary.

The handler validates trimmed name/description, integer capacity of at least one, and a non-empty start value. `normalizeLocalDateTime` requires the `YYYY-MM-DDTHH:mm` shape, rejects invalid dates, converts local time to UTC, and rejects values at or before `Date.now()` ([schema and date normalization](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/lib/classes.mutation.handler.ts#L4-L24), [normalization implementation](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/lib/classes.mutation.handler.ts#L126-L198)). Unit tests should use fake time and cover malformed dates, impossible calendar values, exact-now/past values, trimmed fields, non-integer/zero/NaN capacity, and valid local-to-UTC conversion.

Recurring-series construction validates an inclusive end date, rejects an end before the first class, advances in seven-day local-time increments, and caps the series at 104 occurrences ([recurring series builder](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/lib/classes.mutation.handler.ts#L200-L256)). It is currently private, so it can be covered through `createClass`; exporting it only for tests would weaken the module boundary. A narrow fake Supabase adapter is sufficient to observe whether persistence was reached.

For updates, `updateClass` counts confirmed reservations and rejects lower capacity before any update. It then rejects a start-time change when the selected class has confirmed reservations. Series updates scan every target class and reject if any occurrence exceeds the proposed capacity ([single-class and series checks](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/lib/classes.mutation.handler.ts#L327-L390)). Tests must assert that `.update()` is not called on every rejection, not only that the returned code is correct.

The capacity and start-time decisions are separated from persistence by multiple queries. A reservation can change between the count and update, and no database constraint or transactional RPC closes that race. The current contract therefore proves deterministic rejection for observed state, not concurrency safety. The implementation plan should either explicitly characterize this limitation or move the protected update into an atomic database function before claiming risk #2 is fully controlled.

### Ownership and Privileged Access

Middleware resolves the user from the cookie-bound Supabase client, loads the role from `profiles`, and redirects non-manager/admin users away from privileged route prefixes ([middleware session and role resolution](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/middleware.ts#L12-L56)). Manager APIs repeat this role check. Unit/route tests should verify these fast-fail behaviors, including the `role=null` case caused by a missing or unreadable profile.

Database policies remain authoritative. Authenticated clients can select only their own reservations, managers/admins can select all reservations, and only managers/admins can insert, update, or delete classes ([RLS policies](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/supabase/migrations/20260630130000_admin_access_rls.sql#L6-L61)). The booking RPC independently requires `p_user_id = auth.uid()`, so bypassing the application handler does not permit booking for another user.

Focused local-Supabase contracts should use separate authenticated clients for client A, client B, and manager/admin. They should prove client A cannot observe client B's reservation, a client cannot mutate classes, a manager can perform the intended class operation, and a mismatched booking user receives `FORBIDDEN` with no insert. Do not mock `auth.uid()`, `get_my_role()`, the RPC, or the table query in these tests; doing so replaces the behavior under test.

### Test Harness and Placement

There is no test runner, test script, test configuration, or test dependency in the current package manifest ([package manifest](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/package.json#L1-L48)). Phase 1 should add Vitest with a Node environment and keep tests close to the contracts they exercise. A browser DOM environment is not needed for this phase.

Recommended initial slices:

1. `src/lib/booking.handler.test.ts`: RPC result mapping with a minimal typed stub.
2. `src/lib/classes.mutation.handler.test.ts`: exported date normalization plus public `createClass`/`updateClass` behavior using fake time and a narrow fluent Supabase adapter.
3. `src/pages/api/reservations/create.test.ts` and `src/pages/api/classes/[id]/update.test.ts`: request parsing, auth/role rejection, handler result-to-redirect mapping where practical without booting a browser.
4. A local-Supabase contract suite outside `src/` for booking atomicity, ownership, RLS visibility, and class-write authorization. Keep its command and prerequisites separate from the fast unit command.

Phase 1 must update cookbook sections 6.1, 6.2, and 6.4 in [the test plan](../../foundation/test-plan.md) with the final locations, naming convention, reference tests, commands, fixture strategy, and the boundary between stubs and local Supabase.

## Code References

- [src/lib/booking.handler.ts](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/lib/booking.handler.ts#L4-L92) - booking RPC invocation and stable application result mapping.
- [src/pages/api/reservations/create.ts](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/pages/api/reservations/create.ts#L8-L61) - form validation, authenticated context, and redirect transport.
- [supabase/migrations/20260830121000_enforce_cancelled_class_reservation_guard.sql](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/supabase/migrations/20260830121000_enforce_cancelled_class_reservation_guard.sql#L1-L69) - atomic reservation and ownership contract.
- [src/lib/classes.mutation.handler.ts](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/lib/classes.mutation.handler.ts#L126-L390) - server validation, recurring dates, capacity checks, and update gating.
- [src/pages/api/classes/[id]/update.ts](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/pages/api/classes/%5Bid%5D/update.ts#L12-L39) - privileged route contract and form coercion.
- [src/middleware.ts](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/src/middleware.ts#L12-L56) - SSR session, role resolution, and privileged-route guard.
- [supabase/migrations/20260630130000_admin_access_rls.sql](https://github.com/sylmilczar/FitSpotApp/blob/e79e281313cf0e2dc476e7222bc0e6515fccdae9/supabase/migrations/20260630130000_admin_access_rls.sql#L6-L70) - authoritative class-write and reservation-read policies.

## Architecture Insights

- The application uses discriminated result objects and redirect codes as its stable UI contract; raw database messages should remain behind handler boundaries.
- Reservation correctness is database-owned and atomic. Tests that stub the RPC verify translation only, not booking safety.
- Manager class safety is currently application-owned and non-atomic. This differs materially from the reservation design and must be visible in the plan's claims.
- Authentication and authorization use defense in depth: middleware and endpoints improve UX and fail fast, while RLS/RPC enforcement protects direct database access.
- Browser constraints are convenience validation. The Zod/date handler path is the server-side contract and should receive exhaustive invalid-input coverage.

## Historical Context (from Prior Changes)

- [Booking domain foundation plan](../../archive/2026-06-30-booking-domain-foundation/plan.md) established the atomic RPC and stable guardrail-code contract. Later migrations added ownership and cancelled-class enforcement without changing the application entry point.
- [Reserve class with guardrails plan](../../archive/2026-07-29-reserve-class-with-guardrails/plan.md) established the server-first POST/redirect flow and upcoming-reservations read model.
- [Admin access foundation plan](../../archive/2026-06-30-admin-access-foundation/plan.md) established `client | manager | admin`, cookie-based role resolution, and RLS as the authoritative access boundary.
- [Manager class management plan](../manager-manage-classes-and-attendees/plan.md) introduced class mutation handlers, attendee access, soft cancellation, and the manager-facing validation outcomes now covered by risks #2 and #4.
- Commit `b35ff22` added the explicit cancelled-class booking guard immediately before this research baseline; contract fixtures must include this newest guard.

## Related Research

No existing `research.md` directly covers this rollout phase. The historical plans above are supplementary context; this document is the current-code baseline for the next `/10x-plan` handoff.

## Open Questions

1. Should Phase 1 repair manager-update atomicity by introducing a database function, or document the race and limit the test claim to observed-state validation?
2. Should focused Supabase contracts run automatically in the default `npm test` command, or under a separate command that requires the local Supabase stack?
3. Should `AUTH_REQUIRED` and `FORBIDDEN` become explicit `BookingContractResult` codes, or remain database-only outcomes tested directly at the RPC boundary?
4. Which fixture lifecycle will isolate authenticated users and rows without relying on mutable shared seed data?
