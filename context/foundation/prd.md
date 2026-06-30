---
project: FitSpotApp for a Small Fitness Club
version: 1
status: draft
created: 2026-06-15
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-09-14
  after_hours_only: true
---

## Vision & Problem Statement

Class booking information is scattered across phone calls, social media messages, and other manual channels. Fitness class clients in a single small fitness club feel this pain when they want to quickly decide whether they can join a specific upcoming class. Today this causes booking abandonment and forces staff to repeatedly answer availability questions.

When availability and reservation are handled in one fast self-service flow, completion improves and staff coordination overhead drops.

## User & Persona

Primary persona: client of a single fitness club who wants to discover classes, check remaining spots, and reserve a place in under one minute.

## Success Criteria

### Primary

- End-to-end booking flow works: a client can sign up, log in, browse upcoming classes, reserve a spot, and see the reservation reflected with updated availability.

### Secondary

- Clients can cancel bookings and available spot counts recalculate correctly.

### Guardrails

- Full classes cannot be reserved (no overbooking).
- The same user cannot reserve the same class twice.
- Reservations cannot be created after class start time.

## User Stories

### US-01: Client reserves an available class

- **Given** a registered client who is logged in and at least one upcoming class with free spots
- **When** the client browses classes, selects one that has not started, and confirms reservation
- **Then** the reservation is created, available spots decrease, and the reservation appears in the client's upcoming reservations

#### Acceptance Criteria

- Reservation succeeds only when class capacity is not exceeded
- Reservation is blocked if the same client already reserved that class
- Reservation is blocked once class start time has passed
- Successful reservation updates available spots in the class view

## Functional Requirements

### Authentication

- FR-001: Client can create an account. Priority: must-have
  > Socrates: Counter-argument considered: "guest-to-booking conversion could be enough for MVP and full signup may add friction." Resolution: kept; account creation remains required for reservation ownership and duplicate-booking prevention.
- FR-002: Client can log in. Priority: must-have
  > Socrates: Counter-argument considered: "magic-link or one-time booking tokens might be simpler than password login." Resolution: kept; email and password remains the MVP auth baseline for role-gated access.

### Class Discovery

- FR-003: Client can browse upcoming classes. Priority: must-have
  > Socrates: Counter-argument considered: "direct class links from admin messages might be enough." Resolution: kept; in-app browsing is required to remove manual channel dependency.
- FR-004: Client can view class details including available spots. Priority: must-have
  > Socrates: Counter-argument considered: "minimal card view could be enough if details are standardized." Resolution: kept; explicit available-spots visibility is part of the booking decision moment.

### Reservations

- FR-005: Client can reserve a spot in a class. Priority: must-have
  > Socrates: Counter-argument considered: "if capacity handling is not robust yet, reservations could create trust issues." Resolution: kept; this FR remains core, with strict capacity guardrails enforced.
- FR-006: Client can cancel a reservation. Priority: nice-to-have
  > Socrates: Counter-argument considered: "cancellation adds policy and edge-case complexity and can ship in v2." Resolution: accepted; kept as nice-to-have for this MVP.
- FR-007: Client can view upcoming reservations. Priority: must-have
  > Socrates: Counter-argument considered: "single-class users may not need a reservations view yet." Resolution: kept; upcoming reservations visibility reduces confusion after booking.

### Class Management

- FR-008: Manager or Admin can create, edit, and delete classes and set participant limits. Priority: must-have
  > Socrates: Counter-argument considered: "only create/edit may be enough and delete could wait." Resolution: kept; full schedule management remains in scope for operational completeness.
- FR-009: Manager or Admin can view class attendees. Priority: must-have
  > Socrates: Counter-argument considered: "occupancy count only may be enough for first release." Resolution: kept; attendee visibility is required for class operations.

### User Management

- FR-010: Admin can manage users and assign roles (Client or Manager). Priority: should-have
  > Socrates: Counter-argument considered: "manual role updates in Supabase dashboard may be enough for MVP." Resolution: kept; role management in-app is needed to avoid operational bottlenecks and reduce privileged manual DB access.

## Non-Functional Requirements

- Booking requests complete in under 2 seconds for at least 95% of requests.
- Available spot counts are visibly updated immediately after reservation creation or cancellation.
- Reservation endpoints are accessible only to authenticated users with allowed roles; guests cannot access reservation actions.

## Business Logic

When a class reaches its participant limit, the app prevents additional reservations for clients.

Inputs: class participant limit and current reservation count.

Output: reservation accepted or rejected.

User sees: decision at the booking page when attempting to reserve a spot.

## Access Control

- Authentication: email + password login for registered accounts.
- Roles:
  - Guest: can view upcoming classes and class details, but cannot reserve (no authenticated session).
  - Client: can reserve and cancel reservations, and view upcoming reservations.
  - Manager: can create, edit, and delete classes, set participant limits, and view attendees.
  - Admin: can manage users and has all Manager permissions.
- Route behavior:
  - Reservation actions require authenticated Client role.
  - Class management routes require Manager or Admin role.
  - User management routes require Admin role.
  - Unauthenticated users trying to reserve are redirected to login/registration.

## Non-Goals

- No online payments in MVP: reservations are handled without payment processing integration.
- No memberships or class-package billing in MVP: subscription and pass logic are excluded from first release scope.
- No multi-club support in MVP: the product is scoped to one fitness club.
- No mobile native app in MVP: delivery is web only.

## Open Questions

1. None at this stage.
