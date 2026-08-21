# Manager Manage Classes and Attendees - Plan Brief

> Full plan: `context/changes/manager-manage-classes-and-attendees/plan.md`

## What & Why

S-04 adds the club operations surface: managers and admins can manage all classes and inspect attendee details. It builds on the existing role/RLS foundation and keeps clients focused on the public booking flow.

## Desired End State

Privileged staff use `/manager/classes` to create, edit, and either delete or cancel classes, then open an attendee view showing email, reservation status, and reservation time. Classes with no reservations can be deleted; classes with reservation history remain in history and are cancelled instead. Cancelled classes stay visible in public class views with a clear `CANCELLED` label, but cannot be reserved.

## Key Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| MVP scope | CRUD + attendee view | Directly satisfies FR-008 and FR-009. |
| Deletion/cancellation | Delete empty classes; cancel classes with reservation history | Avoids needless historical rows while protecting users who were already registered. |
| Manager ownership | All club classes | Matches current single-club RLS model. |
| Attendee fields | Email, status, reserved at | Available from auth/reservation data and sufficient for staff operations. |
| Endpoint style | POST form actions with redirects | Matches existing Astro SSR and reservation flow. |
| Time input | Browser local datetime converted to UTC | Natural for staff while preserving UTC storage/read models. |
| Edit guardrail | Capacity cannot drop below confirmed count | Prevents inconsistent occupancy after edits. |
| Privileged route | `/manager/classes` | Clear staff namespace and explicit role protection. |
| Tests | Existing lint/typecheck/build + manual RLS/CRUD | No test runner is configured in the repository. |

## Scope

**In scope:**
- Class lifecycle status and public `CANCELLED` presentation
- Manager/admin class create, edit, delete-empty, and cancel-with-history
- Manager/admin attendee read model
- Role-protected `/manager/classes` workspace
- Role-aware Topbar link

**Out of scope:**
- Hard delete for classes with reservation history
- Recurring/bulk class creation
- Per-manager ownership
- Attendee search/export/pagination
- Manager cancellation of reservations
- New automated test framework

## Phases at a Glance

| Phase | What it delivers | Main risk |
| --- | --- | --- |
| 1. Status and attendee read models | Additive class status + secure attendee RPC | Auth.users data exposure and public filter consistency |
| 2. Handlers and validation | Mutation service with UTC/capacity rules | Browser-local timezone and edit invariants |
| 3. Protected endpoints | POST actions and manager route guard | Inconsistent auth/error redirects |
| 4. Manager workspace | Staff UI, attendee details, privileged navigation | Cross-page form/result UX |

**Prerequisites:** S-01, F-01, F-02 are implemented; F-01 roadmap status needs synchronization before final archive.
**Estimated effort:** 4 implementation sessions across 4 phases.

## Risks & Assumptions

- The single-club model intentionally allows any manager to manage all classes.
- Attendee email projection must remain restricted to manager/admin callers.
- Cancelled classes remain readable to staff and clients with a `CANCELLED` status, but are excluded from reservation actions.
- Existing reservation rows remain valid history after class cancellation.
