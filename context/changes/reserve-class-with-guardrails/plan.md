# Reserve Class With Guardrails Implementation Plan

## Overview

Implement roadmap slice S-02 so an authenticated client can reserve an eligible class with domain guardrails enforced, and can see their upcoming reservations directly on the classes page.

## Current State Analysis

Booking foundations and class browsing are already in place, but reservation flow is not exposed to users yet.

## Desired End State

On class details, users can attempt reservation and receive clear outcome feedback for success or guardrail failures. Guests are redirected to sign-in and returned to the same class page. Logged-in users see a "my upcoming" reservations section on `/classes` populated from a dedicated read-model contract (7-day window aligned with timetable).

### Key Discoveries:

- Reservation guardrails already exist in DB RPC `create_reservation(...)` and are surfaced in TS wrapper (`CLASS_FULL`, `ALREADY_RESERVED`, `CLASS_STARTED`) via `src/lib/booking.handler.ts`.
- Public class list/details read models are already implemented and UTC-windowed (`src/lib/classes.handler.ts`, `src/pages/classes/index.astro`).
- There is currently no reservation API endpoint and no user-upcoming reservations read-model/API surface.
- Auth return-to flow is available and safe (`src/lib/routing.ts`, `src/pages/api/auth/signin.ts`).

## What We're NOT Doing

- Reservation cancellation (FR-006) in this change.
- Manager/admin reservation operations beyond self-view behavior.
- New standalone `/reservations` page (upcoming list is integrated into `/classes`).

## Implementation Approach

Add one user-scoped reservation read-model RPC and one reservation mutation API endpoint. Then wire reservation UX into class details with dedicated modal feedback, and add "my upcoming" section into the existing classes page for logged-in users.

## Critical Implementation Details

Reservation outcomes must be deterministic and mapped by code, not by raw backend messages. UI must use an explicit dictionary for `CLASS_FULL`, `ALREADY_RESERVED`, `CLASS_STARTED`, and `UNKNOWN` fallback so behavior remains stable across backend message changes.

## Phase 1: Reservation Contracts and Backend Surfaces

### Overview

Introduce reservation API and user-upcoming read-model surfaces while preserving existing booking guardrails.

### Changes Required:

#### 1. User upcoming reservations read-model

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_user_upcoming_reservations.sql`

**Intent**: Add DB-level contract that returns a logged-in user's upcoming reservations aligned to timetable window semantics.

**Contract**: New RPC `get_user_upcoming_reservations(p_user_id uuid)` returning reservation + class fields needed by UI, filtered to confirmed reservations within 7-day timetable window.

#### 2. Reservation domain handler surface

**File**: `src/lib/booking.handler.ts`

**Intent**: Expose a stable application-level contract for reservation create result mapping and upcoming reservations retrieval.

**Contract**: Keep existing create guardrail behavior, add typed helper for upcoming reservations read-model, and preserve discriminated-union style used across handlers.

#### 3. Reservation API endpoint

**File**: `src/pages/api/reservations/create.ts` (new)

**Intent**: Provide canonical POST entrypoint for reservation creation.

**Contract**: `POST /api/reservations/create` accepts class id, requires authenticated user, invokes booking handler, and redirects with result code consumable by class-details modal.

#### 4. Shared types for reservation read model and UI result mapping

**File**: `src/types.ts`

**Intent**: Add explicit, reusable contracts for reservation list items and reservation action result states.

**Contract**: New types for upcoming reservation rows and frontend-safe reserve result keys.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- New migration applies cleanly in local reset flow (`npx supabase db reset`).

#### Manual Verification:

- Reservation API returns stable result mapping for success and each guardrail condition.
- Upcoming reservations RPC returns only logged-in user's reservations in 7-day window.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Reservation Action UX on Class Details

### Overview

Add reservation interaction to class details with guest redirect handling, pending-state UX, and dedicated modal feedback.

### Changes Required:

#### 1. Reserve CTA and submission path

**File**: `src/pages/classes/[id].astro`

**Intent**: Enable user reservation action from class details under valid availability states.

**Contract**: Show reserve action when class is reservable, submit via `POST /api/reservations/create`, and include class id + return context.

#### 2. Guest redirect behavior for reserve action

**File**: `src/pages/api/reservations/create.ts`

**Intent**: Ensure guests are redirected to auth and returned to the same class details page.

**Contract**: Unauthenticated reserve attempts redirect to `/auth/signin?returnTo=/classes/[id]`.

#### 3. Dedicated result modal

**Files**: `src/pages/classes/[id].astro`, `src/components/classes/*` (new component if needed)

**Intent**: Provide explicit post-action feedback using dedicated modal with message and close action.

**Contract**: Modal displays mapped message for success/guardrail outcomes, includes only dismiss/close behavior (no navigation CTA).

#### 4. Pending/double-submit protection

**Files**: `src/pages/classes/[id].astro`, optional reservation button component

**Intent**: Reduce accidental duplicate submits while keeping backend guardrail as source of truth.

**Contract**: Reserve trigger is disabled during pending submission; backend still handles idempotency via existing guardrail logic.

#### 5. Canonical result transport for modal feedback

**Files**: `src/pages/api/reservations/create.ts`, `src/pages/classes/[id].astro`

**Intent**: Ensure reservation outcomes survive redirect and are rendered deterministically in the class-details modal.

**Contract**: Reservation API redirects back to class details with a canonical result code in query params (success/guardrail/unknown); class-details modal maps code to message and clears result params after dismiss.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes after class-details reservation integration.
- `npm run lint` passes after class-details reservation integration.

#### Manual Verification:

- Guest clicking reserve is redirected to sign-in and returned to same class page after login.
- Successful reserve shows dedicated modal success message.
- `CLASS_FULL`, `ALREADY_RESERVED`, and `CLASS_STARTED` each show correct modal error message.
- Rapid double-click does not create duplicate reservations.
- Closing the modal clears result query params so stale outcomes are not replayed on refresh.
- Reservation API reads authenticated user from request context and redirects unauthenticated reserve attempts to sign-in with class-details return path preserved.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: "My Upcoming" Section on Classes Page

### Overview

Integrate user upcoming reservations into `/classes` for authenticated users without adding a new route.

### Changes Required:

#### 1. Classes page upcoming reservations section

**File**: `src/pages/classes/index.astro`

**Intent**: Show logged-in user's upcoming reservations alongside existing timetable experience.

**Contract**: Render section only for authenticated users, consume new upcoming reservations contract, and include empty/error states.

#### 2. Reservation list presentation component(s)

**Files**: `src/components/classes/*` (new components if needed)

**Intent**: Keep reservation row rendering consistent with app visual language.

**Contract**: Present class name, start time, and key reservation metadata expected by FR-007.

#### 3. Handler integration for user-scoped reads

**File**: `src/lib/booking.handler.ts` and page integration call-sites

**Intent**: Ensure `/classes` page can fetch user-scoped reservation data with authenticated context.

**Contract**: Uses authenticated client/session context rather than public read client path.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes after `/classes` upcoming integration.
- `npm run lint` passes after `/classes` upcoming integration.

#### Manual Verification:

- Authenticated user sees upcoming reservations section on `/classes`.
- Section shows only that user's reservations in 7-day window.
- Guest does not see the section.
- Reservation and availability updates remain consistent after booking.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Testing Strategy

Phase gates for this change are TypeScript, lint, and manual verification listed in `## Progress`.

### Post-slice follow-up tests (not required to close this change):

- Guardrail code-to-message mapping utility.
- Reservation result contract normalization with `UNKNOWN` fallback.

### Post-slice follow-up integration tests (not required to close this change):

- `POST /api/reservations/create` for success and each guardrail error.
- Auth redirect path with `returnTo` back to class details.
- User-upcoming read-model alignment with timetable window.

### Manual Testing Steps:

1. As guest, open class details and attempt reserve -> redirected to sign-in -> returned to same class.
2. As authenticated client, reserve available class -> modal success shown.
3. Repeat reserve for same class -> `ALREADY_RESERVED` modal shown.
4. Reserve full class and started class scenarios -> correct guardrail modal shown.
5. Open `/classes` as authenticated user -> "my upcoming" section shows correct 7-day entries.

## Performance Considerations

- Avoid N+1 fetching on `/classes` by retrieving upcoming reservations in one query contract.
- Keep reservation mutation request/response lightweight and code-based.

## Migration Notes

- Add one migration for `get_user_upcoming_reservations(...)` function.
- Validate migration in local reset flow before UI wiring.

## References

- Roadmap: `context/foundation/roadmap.md` (S-02)
- PRD: `context/foundation/prd.md` (US-01, FR-005, FR-007)
- Booking contract foundation: `supabase/migrations/20260630104321_booking_domain_foundation.sql`
- Existing read model: `src/lib/classes.handler.ts`
- Class details UI: `src/pages/classes/[id].astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Reservation Contracts and Backend Surfaces

#### Automated

- [x] 1.1 TypeScript compiles (`npx tsc --noEmit`) — a6d2a84
- [x] 1.2 Lint passes (`npm run lint`) — a6d2a84
- [x] 1.3 New migration applies cleanly in local reset flow — a6d2a84

#### Manual

- [x] 1.4 Reservation API result mapping covers success and guardrails — a6d2a84
- [x] 1.5 Upcoming reservations RPC is user-scoped in 7-day window — a6d2a84

### Phase 2: Reservation Action UX on Class Details

#### Automated

- [x] 2.1 TypeScript compiles after class-details reservation integration — 43179d7
- [x] 2.2 Lint passes after class-details reservation integration — 43179d7

#### Manual

- [x] 2.3 Guest reserve redirects to signin and returns to same class — 43179d7
- [x] 2.4 Success reserve shows dedicated modal message — 43179d7
- [x] 2.5 Guardrail codes show correct modal messages — 43179d7
- [x] 2.6 Double-submit does not create duplicate reservations — 43179d7
- [x] 2.7 Closing modal clears reserve result query params — 43179d7
- [x] 2.8 Reservation API auth context and signin redirect path are preserved — 43179d7

### Phase 3: "My Upcoming" Section on Classes Page

#### Automated

- [x] 3.1 TypeScript compiles after `/classes` upcoming integration — 06bbede
- [x] 3.2 Lint passes after `/classes` upcoming integration — 06bbede

#### Manual

- [x] 3.3 Authenticated user sees "my upcoming" section on `/classes` — 06bbede
- [x] 3.4 Section shows only logged-in user's 7-day reservations — 06bbede
- [x] 3.5 Guest does not see "my upcoming" section — 06bbede
- [x] 3.6 Availability and reservations remain consistent after booking — 06bbede
