---
project: FitSpotApp for a Small Fitness Club
context_type: greenfield
created: 2026-06-12
updated: 2026-06-15
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-09-14
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: pain category
      decision: workflow friction + missing capability + coordination overhead
    - topic: core insight
      decision: users abandon booking when answers are scattered and slow to get
    - topic: primary persona scope
      decision: a specific role inside one organization (fitness class client in one club)
    - topic: auth strategy
      decision: login with email and password
    - topic: access model
      decision: three roles (administrator, client, guest)
    - topic: mvp timeline
      decision: 3-week after-hours MVP
    - topic: success criteria guardrails
      decision: no overbooking, no duplicate booking, no post-start booking
    - topic: fr prioritization
      decision: FR-006 marked as nice-to-have
    - topic: socrates resolution
      decision: keep FR set as written with Socrates notes; no additional FR scope cuts
    - topic: business logic rule
      decision: prevent reservations once participant limit is reached
    - topic: business logic shape
      decision: validation
    - topic: nfr commitments
      decision: p95 booking under 2s, immediate spot updates, authenticated access for reservation endpoints
    - topic: product type
      decision: web app
    - topic: target scale
      decision: users dozens to one hundred (medium), low traffic, small data volume
    - topic: timeline framing
      decision: after-hours only, hard deadline 2026-09-14, preferred target 2026-08-10
    - topic: non-goals
      decision: no online payments or memberships/packages, no multi-club support, no mobile native app
  frs_drafted: 9
  quality_check_status: accepted
---

# Shape Notes

Seed idea source: idea-notes.md

## Vision & Problem Statement

Pain: class booking information is scattered across phone calls, social media messages, and other manual channels.

Person: fitness class clients of a single small fitness club.

Moment: when a client wants to quickly decide whether they can join a specific upcoming class.

Cost today: clients abandon booking before completing a reservation, and staff spend time manually answering repetitive availability questions.

Core insight: when availability and reservation are handled in one fast self-service flow, completion improves and staff coordination overhead drops.

## User & Persona

Primary persona: client of a single fitness club who wants to discover classes, check remaining spots, and reserve a place in under one minute.

## Access Control

- Authentication: email + password login for registered accounts.
- Roles:
  - Guest: can view upcoming classes and class details, but cannot reserve.
  - Client: can reserve and cancel reservations, and view upcoming reservations.
  - Administrator: can create, edit, and delete classes, set participant limits, and view attendees.
- Route behavior:
  - Reservation actions require authenticated Client role.
  - Class management routes require Administrator role.
  - Unauthenticated users trying to reserve are redirected to login/registration.

## Success Criteria

### Primary

- End-to-end booking flow works: a client can sign up, log in, browse upcoming classes, reserve a spot, and see the reservation reflected with updated availability.

### Secondary

- Clients can cancel bookings and available spot counts recalculate correctly.

### Guardrails

- Full classes cannot be reserved (no overbooking).
- The same user cannot reserve the same class twice.
- Reservations cannot be created after class start time.

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

- FR-008: Administrator can create, edit, and delete classes and set participant limits. Priority: must-have
  > Socrates: Counter-argument considered: "only create/edit may be enough and delete could wait." Resolution: kept; full schedule management remains in scope for operational completeness.
- FR-009: Administrator can view class attendees. Priority: must-have
  > Socrates: Counter-argument considered: "occupancy count only may be enough for first release." Resolution: kept; attendee visibility is required for class operations.

## User Stories

### US-01: Client reserves an available class

- Given a registered client who is logged in and at least one upcoming class with free spots
- When the client browses classes, selects one that has not started, and confirms reservation
- Then the reservation is created, available spots decrease, and the reservation appears in the client's upcoming reservations

#### Acceptance Criteria

- Reservation succeeds only when class capacity is not exceeded
- Reservation is blocked if the same client already reserved that class
- Reservation is blocked once class start time has passed
- Successful reservation updates available spots in the class view

## Business Logic

When a class reaches its participant limit, the app prevents additional reservations for clients.

Inputs: class participant limit and current reservation count.

Output: reservation accepted or rejected.

User sees: decision at the booking page when attempting to reserve a spot.

## Non-Functional Requirements

- Booking requests complete in under 2 seconds for at least 95% of requests.
- Available spot counts are visibly updated immediately after reservation creation or cancellation.
- Reservation endpoints are accessible only to authenticated users with allowed roles; guests cannot access reservation actions.

## Non-Goals

- No online payments in MVP: reservations are handled without payment processing integration.
- No memberships or class-package billing in MVP: subscription and pass logic are excluded from first release scope.
- No multi-club support in MVP: the product is scoped to one fitness club.
- No mobile native app in MVP: delivery is web only.

## Notes

- Scale probe insight: at 100x scale, the booking rule remains the same, while stronger concurrency controls are required to prevent overbooking.
- Timeline note: preferred target date is 2026-08-10; hard deadline is 2026-09-14.

## Quality cross-check

- Access Control: present.
- Business Logic: present with one-sentence rule.
- Project artifacts: present.
- Timeline-cost acknowledgment: present via 3-week MVP timeline.
- Non-Goals: present.
- Preserved behavior: n/a for greenfield.
- Gaps: none.
