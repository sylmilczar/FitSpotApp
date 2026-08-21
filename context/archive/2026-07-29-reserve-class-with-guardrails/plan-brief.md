# Reserve Class With Guardrails - Plan Brief

> Full plan: `context/changes/reserve-class-with-guardrails/plan.md`

## What & Why

This plan delivers S-02, the north-star MVP slice: a client reserves a class with enforced guardrails and sees their upcoming reservations. The goal is to validate end-to-end self-service booking speed while preventing overbooking, duplicates, and late reservations.

## Starting Point

Booking domain guardrails already exist in SQL RPC and TS handler contracts, and S-03 class browsing/details are complete. What is missing is user-facing reservation mutation flow and "my upcoming" visibility.

## Desired End State

From class details, a user can reserve with clear modal feedback for success or guardrail outcomes. Guests are routed through sign-in and returned to the same class page. On `/classes`, logged-in users see a 7-day "my upcoming" section sourced from a dedicated user read model.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Reservation mutation route | `POST /api/reservations/create` | Creates a clear reservation API contract that scales with future reservation endpoints. | Plan |
| Upcoming reservations placement | Section on `/classes` | Avoids route sprawl while satisfying FR-007 in current MVP flow. | Plan |
| Guest reserve behavior | Redirect to `/auth/signin?returnTo=/classes/[id]` | Preserves intent and conversion by returning users to exact class context. | Plan |
| Reservation result UX | Dedicated modal with message + close | Gives explicit feedback with minimal interaction complexity. | Plan |
| Upcoming data source | New RPC `get_user_upcoming_reservations` | Keeps filtering logic centralized and consistent with DB contracts. | Plan |
| Time window for upcoming | Same 7-day window as timetable | Aligns user mental model between schedule and reservations panel. | Plan |
| Guardrail message handling | Explicit code->message mapping + `UNKNOWN` fallback | Stabilizes UX independently from backend raw message text. | Plan |
| FR-006 scope | Out of scope | Protects S-02 focus and delivery speed for MVP validation. | Plan |

## Scope

**In scope:**
- Reservation create endpoint and handler wiring
- User-upcoming reservations RPC contract
- Reserve CTA on class details with auth redirect
- Dedicated modal feedback for success/guardrail outcomes
- Pending-state protection against double-submit
- "My upcoming" section on `/classes` for logged-in users

**Out of scope:**
- Reservation cancellation (FR-006)
- New standalone reservations route
- Manager/admin reservation operations beyond self-view behavior

## Architecture / Approach

Use existing booking RPC guardrails for mutation, add one new DB read-model RPC for user upcoming reservations, and connect both contracts into Astro pages. Reservation flow remains server-first (API + redirects), while UI feedback and state are deterministic from typed result codes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Reservation contracts and backend surfaces | User-upcoming RPC + create reservation API + typed contracts | Contract mismatch between SQL results and TS mapping |
| 2. Reservation action UX on class details | Reserve CTA, auth return flow, dedicated modal, pending state | Inconsistent feedback across guardrail outcomes |
| 3. "My upcoming" section on `/classes` | Logged-in user reservation panel in 7-day window | Data consistency drift vs timetable/availability |

**Prerequisites:** S-01, S-03, F-01, F-02, F-03 are completed or available
**Estimated effort:** ~2-3 implementation sessions across 3 phases

## Open Risks & Assumptions

- Existing RPC contracts must stay stable in deployed Supabase environment.
- 7-day window alignment assumes UTC/business-time semantics stay unchanged.
- Modal flow assumes class-details page can carry/resolve status feedback without introducing UX regressions.

## Success Criteria (Summary)

- Authenticated client can reserve eligible class; guardrails are enforced and clearly communicated.
- Guest reserve intent survives auth round-trip and returns to same class details page.
- Logged-in user sees accurate 7-day upcoming reservations section on `/classes`.
