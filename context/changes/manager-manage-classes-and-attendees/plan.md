# Manager Manage Classes and Attendees Implementation Plan

## Overview

Implement roadmap slice S-04 so managers and admins can manage all club classes and view attendee details without exposing staff operations to clients or guests.

## Current State Analysis

The classes table, role model, middleware role resolution, and manager/admin RLS policies already exist. Public class browsing and reservation flows are complete, but there is no staff-facing namespace, class CRUD API, class management handler, or attendee read model.

### Key Discoveries:

- `public.classes` already has `name`, `description`, `capacity`, `starts_at`, and RLS policies permitting manager/admin insert, update, and delete.
- `public.reservations` has manager/admin select policy, but no dedicated attendee read model and no email projection for staff.
- `src/middleware.ts` protects `/admin` for manager/admin; S-04 will add equivalent protection for `/manager`.
- Existing Astro pages and POST form endpoints use SSR, Zod validation, discriminated `{ ok: true/false }` results, and redirect query parameters.
- The current single-club model gives every manager access to all club classes; no `created_by` ownership model is needed for this slice.

## Desired End State

A manager or admin can open `/manager/classes`, see active and cancelled classes, create a future class, edit a class, choose deletion for a class with no reservations, choose cancellation for a class with reservation history, and open an attendee view showing email, reservation status, and reservation time. Clients and guests are redirected away from the manager namespace. Cancelled classes remain in the database and attendee history remains visible. Public class views keep cancelled classes visible with a `CANCELLED` status, while reservation actions are disabled.

## What We're NOT Doing

- Per-manager class ownership or assignment.
- Recurring/bulk class creation.
- Attendee export, search, pagination, or bulk attendee actions.
- Manager-driven reservation cancellation or reassignment.
- Automated Vitest/Playwright infrastructure in this change.
- Hard deletion of classes that have reservation history.

## Implementation Approach

Add an explicit `class_status` enum with `scheduled/cancelled`, a manager/admin-only attendee RPC, and application handlers for class mutations. Expose mutations through POST form actions and render a server-side `/manager/classes` workspace with create/edit/delete/cancel controls and attendee links. A class with no reservations may be hard-deleted; a class with any reservation history may only be marked `CANCELLED`. Existing RLS remains the database defense; route role checks provide fast application feedback.

## Critical Implementation Details

`starts_at` is entered as browser-local `datetime-local` and converted to an ISO UTC timestamp before persistence. Public class read models return both statuses so the frontend can show `CANCELLED`; manager views include both statuses. Cancelling a class changes status and never deletes its reservations. Hard deletion is allowed only when reservation count is zero.

## Phase 1: Class Status and Attendee Read Models

### Overview

Introduce the database contracts needed for non-destructive class cancellation and manager attendee visibility.

### Changes Required:

#### 1. Class status migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_manager_class_status.sql`

**Intent**: Add explicit class lifecycle state without deleting historical rows.

**Contract**: Create `public.class_status` enum with `scheduled` and `cancelled`, add `status public.class_status not null default 'scheduled'` to `public.classes`, and update public class availability/details functions to return status so frontend views can label cancelled classes without making them reservable.

#### 2. Attendee read model

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_manager_attendees_read_model.sql`

**Intent**: Provide a single manager/admin-scoped contract for attendee rows.

**Contract**: Add `get_class_attendees(p_class_id uuid)` returning reservation id, user id, profile email, reservation status, and created timestamp for both confirmed and cancelled reservations. The function must reject unauthenticated callers and callers whose role is not manager/admin, and must grant execution only to authenticated/service_role. It joins the controlled `profiles.email` projection rather than querying `auth.users` directly.

#### 2a. Profile email projection

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_profile_email_projection.sql`

**Intent**: Provide a safe, public-schema source for manager attendee email display.

**Contract**: Add `email text not null` to `public.profiles`, backfill existing profiles from `auth.users`, and replace the signup trigger function so new profiles copy `new.email`. Preserve the existing profile RLS policy so clients can read only their own profile.

#### 3. Shared domain types

**File**: `src/types.ts`

**Intent**: Represent lifecycle state, manager form payloads, and attendee rows.

**Contract**: Add `ClassStatus`, `CreateClassInput`, `UpdateClassInput`, `ClassAttendeeItem`, typed class mutation result unions, and `CLASS_CANCELLED` to the reservation guardrail code contract.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies all migrations and seed data.
- `npx tsc --noEmit` passes.
- `npm run lint` passes.

#### Manual Verification:

- A manager/admin can call the attendee RPC for a class and sees confirmed plus cancelled rows.
- A client/guest cannot call the attendee RPC.
- Public `/classes` retains cancelled classes with a `CANCELLED` status and no reservation action, while manager data can still include them.

**Implementation Note**: Pause for manual confirmation after automated checks pass.

## Phase 2: Class Management Handlers and Validation

### Overview

Add a dedicated mutation handler layer with shared validation and capacity safety rules.

### Changes Required:

#### 1. Mutation handler

**File**: `src/lib/classes.mutation.handler.ts`

**Intent**: Keep class mutations separate from the existing public read handler.

**Contract**: Implement `createClass`, `updateClass`, `deleteClass`, `cancelClass`, and `listManagerClasses` using discriminated `{ ok: true/false }` results and the authenticated Supabase client. `deleteClass` succeeds only when the class has zero reservations; otherwise it returns stable `HAS_RESERVATIONS` feedback and the UI offers cancellation instead. Mutations must rely on RLS and map database/configuration errors to stable codes.

#### 2. Validation schemas and form normalization

**Files**: `src/lib/classes.mutation.handler.ts`, `src/types.ts`

**Intent**: Normalize browser form values before database writes.

**Contract**: Require non-empty bounded name, capacity >= 1, future `starts_at`, and on update reject capacity below the current confirmed reservation count. Convert local browser datetime input to UTC ISO before calling the handler.

**Normalization contract**: Add a shared helper that accepts the browser `datetime-local` string and returns either `{ ok: true, startsAtUtc: string }` using `new Date(localValue).toISOString()` or `{ ok: false, code: "INVALID_FORMAT" | "PAST_DATE" }`. Server-side parsing and future-date validation are authoritative; client-side validation is only a convenience.

#### 3. Reservation cancellation guard

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_enforce_cancelled_class_reservation_guard.sql`

**Intent**: Keep soft-cancel consistent with the reservation domain even when callers bypass the public UI.

**Contract**: Replace `create_reservation` with the existing ownership and guardrail checks plus a `CLASS_CANCELLED` rejection before reservation creation. Extend `BookingGuardrailCode` and the reservation result-message mapping so direct RPC and UI outcomes remain deterministic.

#### 3. Public read model compatibility

**File**: `src/lib/classes.handler.ts`

**Intent**: Keep public read contracts consistent with cancelled class visibility and status typing.

**Contract**: Public list/details return both scheduled and cancelled classes with typed status; manager list uses a separate handler/query that includes both statuses.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm run build` passes.

#### Manual Verification:

- Valid create/update payloads produce expected class data.
- Empty name, invalid capacity, past time, and capacity below confirmed count are rejected with stable error feedback.
- Cancelling a class preserves its row and reservations.
- Direct reservation RPC calls for a cancelled class return `CLASS_CANCELLED` and create no reservation.
- Deleting a class with no reservations succeeds, while deleting a class with reservation history is rejected.

**Implementation Note**: Pause for manual confirmation after automated checks pass.

## Phase 3: Role-Protected Class CRUD Endpoints

### Overview

Expose create, update, and cancellation form actions under the manager namespace.

### Changes Required:

#### 1. Route protection

**File**: `src/middleware.ts`

**Intent**: Protect `/manager` routes consistently for authenticated manager/admin users.

**Contract**: Add `MANAGER_ROUTE = "/manager"` and `MANAGER_CLASSES_ROUTE = "/manager/classes"` to `src/lib/routing.ts`. Replace the current hardcoded `/admin` route list with a shared privileged-route guard covering `/manager` and existing `/admin`; unauthenticated users go to sign-in and authenticated users without manager/admin role go to `/classes`.

#### 2. CRUD endpoints

**Files**: `src/pages/api/classes/create.ts`, `src/pages/api/classes/[id]/update.ts`, `src/pages/api/classes/[id]/delete.ts`, `src/pages/api/classes/[id]/cancel.ts`

**Intent**: Provide POST form actions for staff UI.

**Contract**: Validate form data, require manager/admin context, call mutation handlers, and redirect to `/manager/classes` or the relevant edit/attendee view with stable query result codes. Provide separate delete and cancel actions so the UI can follow reservation-history rules.

#### 3. Routing constants

**File**: `src/lib/routing.ts`

**Intent**: Centralize manager route paths.

**Contract**: Export `MANAGER_ROUTE` and `MANAGER_CLASSES_ROUTE`; middleware, Topbar, endpoints, and pages must import these constants rather than duplicating route strings.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm run build` passes.

#### Manual Verification:

- Guest and client requests to `/manager/classes` are redirected appropriately.
- Manager/admin can create, edit, delete an empty class, and cancel a class with reservation history through form actions.
- Invalid or unauthorized API requests cannot mutate classes.
- Delete and cancel endpoints enforce the reservation-history rule.

**Implementation Note**: Pause for manual confirmation after automated checks pass.

## Phase 4: Manager Workspace and Attendee View

### Overview

Build the staff-facing SSR workspace with class forms, status visibility, and attendee details.

### Changes Required:

#### 1. Manager class workspace

**Files**: `src/pages/manager/classes/index.astro`, `src/pages/manager/classes/new.astro`, `src/pages/manager/classes/[id]/edit.astro`, `src/pages/manager/classes/[id]/attendees.astro`

**Intent**: Give manager/admin users a complete class operations workflow.

**Contract**: List scheduled and cancelled classes, expose create/edit/delete/cancel controls according to reservation count, preserve result query feedback, and link each class to attendee view.

#### 2. Staff components

**Files**: `src/components/manager/ClassForm.astro`, `src/components/manager/ClassList.astro`, `src/components/manager/AttendeeList.astro`

**Intent**: Keep manager UI rendering co-located and reusable across manager pages.

**Contract**: Forms use `datetime-local`, display validation/result messages, and show class status. Attendee list shows email, status, and reserved-at timestamp.

#### 3. Privileged navigation

**File**: `src/components/Topbar.astro`

**Intent**: Make the manager workspace discoverable without exposing it to clients/guests.

**Contract**: Render a `/manager/classes` link only when the current role is manager/admin.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm run build` passes.

#### Manual Verification:

- Manager/admin can use the complete CRUD workflow from `/manager/classes`.
- Attendee view shows confirmed and cancelled rows with correct email/status/time.
- Cancelled classes remain visible publicly and to staff with a `CANCELLED` status, but cannot be reserved.
- Client/guest cannot see privileged navigation or access manager pages.
- Manager sees delete for empty classes and cancel for classes with reservation history.

**Implementation Note**: Pause for manual confirmation after automated checks pass.

## Testing Strategy

Phase gates use `npx supabase db reset`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and manual role/RLS verification. Automated unit/E2E tests are a post-slice follow-up because no test runner is configured.

### Post-slice follow-up tests:

- Unit tests for class form normalization and capacity validation.
- Integration tests for manager RLS and attendee RPC authorization.
- E2E test for create/edit/cancel and attendee browsing.

### Manual Testing Steps:

1. Reset local Supabase and create/promote a manager account.
2. As guest and client, open `/manager/classes` and verify redirects.
3. As manager, create a future class with local datetime and verify UTC display.
4. Edit name/time/capacity; attempt invalid and below-confirmed capacity updates.
5. Delete a class with no reservations; verify it is removed from the database and manager list.
6. Attempt to delete a class with reservation history; verify deletion is rejected and cancellation remains available.
7. Cancel a class with reservations; verify history stays visible and the class remains publicly visible with `CANCELLED`.
8. Open attendee view and verify confirmed/cancelled rows and email data.
9. As admin, repeat access checks and confirm same all-club permissions.

## Performance Considerations

Attendee data is loaded per selected class and the MVP intentionally omits pagination. The manager list should use one query/read model and avoid loading attendee rows for every class on the index page.

## Migration Notes

The status migration is additive and preserves existing classes as `scheduled`. Cancellation is represented by status, not deletion, so existing reservations remain queryable. Public read-model functions must be replaced in a follow-up migration rather than editing migration history.

## References

- Roadmap: `context/foundation/roadmap.md` (S-04)
- PRD: `context/foundation/prd.md` (FR-008, FR-009)
- Role foundation: `context/archive/2026-06-30-admin-access-foundation/`
- Booking implementation patterns: `context/archive/2026-07-29-reserve-class-with-guardrails/`
- Public class handler: `src/lib/classes.handler.ts`
- Middleware: `src/middleware.ts`
- RLS migration: `supabase/migrations/20260630130000_admin_access_rls.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Class Status and Attendee Read Models

#### Automated

- [ ] 1.1 Supabase reset applies all migrations
- [ ] 1.2 TypeScript compiles (`npx tsc --noEmit`)
- [ ] 1.3 Lint passes (`npm run lint`)

#### Manual

- [ ] 1.4 Attendee RPC returns confirmed and cancelled rows for manager/admin
- [ ] 1.5 Client/guest cannot call attendee RPC
- [ ] 1.6 Public classes retain cancelled classes with `CANCELLED` status and no reservation action

### Phase 2: Class Management Handlers and Validation

#### Automated

- [ ] 2.1 TypeScript compiles (`npx tsc --noEmit`)
- [ ] 2.2 Lint passes (`npm run lint`)
- [ ] 2.3 Production build passes (`npm run build`)

#### Manual

- [ ] 2.4 Valid class mutations persist expected data
- [ ] 2.5 Invalid and unsafe capacity/time inputs are rejected
- [ ] 2.6 Cancellation preserves class and reservation history
- [ ] 2.7 Cancelled-class reservation RPC guard rejects new reservations
- [ ] 2.8 Deletion is allowed only for classes with zero reservations

### Phase 3: Role-Protected Class CRUD Endpoints

#### Automated

- [ ] 3.1 TypeScript compiles (`npx tsc --noEmit`)
- [ ] 3.2 Lint passes (`npm run lint`)
- [ ] 3.3 Production build passes (`npm run build`)

#### Manual

- [ ] 3.4 Guest/client manager-route redirects work
- [ ] 3.5 Manager/admin CRUD form actions work
- [ ] 3.6 Unauthorized API mutation attempts are rejected

### Phase 4: Manager Workspace and Attendee View

#### Automated

- [ ] 4.1 TypeScript compiles (`npx tsc --noEmit`)
- [ ] 4.2 Lint passes (`npm run lint`)
- [ ] 4.3 Production build passes (`npm run build`)

#### Manual

- [ ] 4.4 Manager/admin complete CRUD workflow works
- [ ] 4.5 Attendee view shows correct confirmed/cancelled data
- [ ] 4.6 Cancelled classes remain visible publicly with `CANCELLED` status and visible to staff
- [ ] 4.7 Privileged navigation and route protection work for roles
- [ ] 4.8 Manager can choose delete for empty classes or cancel for classes with reservations
