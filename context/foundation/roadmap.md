---
project: FitSpotApp for a Small Fitness Club
version: 1
status: draft
created: 2026-06-29
updated: 2026-07-29
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: FitSpotApp for a Small Fitness Club

> Derived from context/foundation/prd.md (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The At a glance table is the index.

## Vision recap

W obecnym stanie rezerwacje zajec sa rozproszone miedzy telefon i komunikatory, co zwieksza porzucenia i obciaza obsluge reczna koordynacja. MVP ma domknac jeden szybki, samoobslugowy przeplyw: klient widzi dostepnosc i wykonuje rezerwacje bez kontaktu ze staffem. Jesli ten przeplyw dziala stabilnie z zasadami pojemnosci i aktualizacja miejsc, rdzenna wartosc produktu jest potwierdzona.

## North star

**S-02: Klient rezerwuje miejsce z zasadami ochronnymi i widzi rezerwacje w nadchodzacych.** To najwczesniejszy kamien walidacyjny dla celu speed, bo sprawdza caly krytyczny obieg wartosci end-to-end.

> North star w tym dokumencie oznacza najmniejszy, kompletny fragment produktu widoczny dla uzytkownika, ktory po dowiezieniu potwierdza glowna hipoteze produktu.

## At a glance

| ID | Change ID | Outcome (user can ...) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | booking-domain-foundation | (foundation) minimalny kontrakt domeny rezerwacji i dostepnosci jest gotowy pod flow klienta | — | FR-003, FR-004, FR-005, FR-007, Business Logic, Non-Functional Requirements | ready |
| F-02 | admin-access-foundation | (foundation) minimalny kontrakt uprawnien dla roli client/manager/admin jest gotowy | — | Access Control, FR-008, FR-009, FR-010 | done |
| S-01 | client-auth-journey | user can create an account and sign in to enter protected booking flow | — | FR-001, FR-002 | ready |
| S-02 | reserve-class-with-guardrails | user can reserve an eligible class and see it in upcoming reservations with spot updates | S-01, S-03, F-01, F-02 | US-01, FR-005, FR-007, Non-Functional Requirements | proposed |
| S-03 | browse-classes-with-availability | user can browse upcoming classes and view available spots in class details | F-01 | FR-003, FR-004 | proposed |
| S-04 | manager-manage-classes-and-attendees | manager (and admin as superset) can manage classes and view class attendees | S-01, F-01, F-02 | FR-008, FR-009 | proposed |
| S-05 | admin-manage-users-and-roles | admin can manage users and assign roles for operations | S-01, F-02 | FR-010, Access Control | proposed |

## Streams

Navigation aid - groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Booking value stream | F-01 -> S-03 -> S-02 | Priorytet dla speed: jak najszybciej domknac flow rezerwacji, ktory waliduje wartosc MVP. |
| B | Access and authorization | F-02 -> S-01 -> S-05 | Stabilizuje granice roli client/manager/admin i domyka administrowanie uzytkownikami bez recznych zmian w bazie. |
| C | Club operations | S-04 | Korzysta z fundamentow i auth, domyka operacyjna strone produktu po walidacji flow klienta. |

## Baseline

What's already in place in the codebase as of 2026-06-29 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present - Astro pages, React islands, Tailwind setup, and UI primitives are in place (astro.config.mjs, src/components/ui/button.tsx, components.json).
- **Backend / API:** partial - API routes exist mainly for auth flows; no full reservation/class domain endpoints yet (src/pages/api/auth/signin.ts, src/pages/api/auth/signup.ts, src/pages/api/auth/signout.ts).
- **Data:** partial - Supabase is configured, but schema/migrations for booking domain are not yet materialized (supabase/config.toml, src/lib/supabase.ts).
- **Auth:** present - SSR cookie-based Supabase auth and middleware route protection are wired (src/middleware.ts, src/lib/supabase.ts).
- **Deploy / infra:** partial - deployment adapter and CI exist, but no container/IaC layer is present (astro.config.mjs, .github/workflows/ci.yml, context/deployment/deploy-plan.md).
- **Observability:** absent - no structured logging/error tracking/metrics instrumentation detected (package.json, context/foundation/infrastructure.md).

## Foundations

### F-01: Kontrakt domeny rezerwacji i dostepnosci

- **Outcome:** (foundation) zasady pojemnosci, blokady duplikatu i blokady po starcie zajec sa jednoznaczne i gotowe do uzycia przez flow klienta.
- **Change ID:** booking-domain-foundation
- **PRD refs:** FR-003, FR-004, FR-005, FR-007, Business Logic, Non-Functional Requirements
- **Unlocks:** S-03, S-02
- **Prerequisites:** —
- **Parallel with:** F-02, S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez tego fundamentu szybkie wdrazanie funkcji moze naruszyc guardraile i wymusic kosztowne poprawki.
- **Status:** ready

### F-02: Kontrakt operacji administracyjnych i uprawnien

- **Outcome:** (foundation) reguly dostepu dla roli client/manager/admin sa gotowe dla operacji rezerwacji, zarzadzania grafikiem i zarzadzania uzytkownikami.
- **Change ID:** admin-access-foundation
- **PRD refs:** Access Control, FR-008, FR-009, FR-010
- **Unlocks:** S-02, S-04, S-05
- **Prerequisites:** —
- **Parallel with:** F-01, S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez jasnych granic rol latwo o regresje bezpieczenstwa przy pracy pod presja czasu.
- **Status:** done

## Slices

### S-01: Podstawowa sciezka konta klienta

- **Outcome:** user can create an account and sign in to enter protected booking flow.
- **Change ID:** client-auth-journey
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** —
- **Parallel with:** F-01, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez domknietego wejscia konta nie da sie wiarygodnie sprawdzic flow rezerwacji z ograniczeniami roli.
- **Status:** ready

### S-03: Przeglad zajec i dostepnych miejsc

- **Outcome:** user can browse upcoming classes and view available spots in class details.
- **Change ID:** browse-classes-with-availability
- **PRD refs:** FR-003, FR-004
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez tego kroku nie da sie zrealizowac decyzji rezerwacyjnej opisanej w Vision.
- **Status:** proposed

### S-02: Rezerwacja miejsca i widok nadchodzacych

- **Outcome:** user can reserve an eligible class and see it in upcoming reservations with spot updates.
- **Change ID:** reserve-class-with-guardrails
- **PRD refs:** US-01, FR-005, FR-007, Non-Functional Requirements
- **Prerequisites:** S-01, S-03, F-01, F-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** To glowna walidacja produktu; odkladanie jej utrzymuje najwyzsze ryzyko bez nauki z realnego przeplywu.
- **Status:** proposed

### S-04: Zarzadzanie zajeciami i uczestnikami przez managera

- **Outcome:** manager (and admin as superset) can manage classes and view class attendees.
- **Change ID:** manager-manage-classes-and-attendees
- **PRD refs:** FR-008, FR-009
- **Prerequisites:** S-01, F-01, F-02
- **Parallel with:** S-02, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zbyt wczesne rozszerzenie na operacje managerskie moze spowolnic domkniecie krytycznej sciezki klienta.
- **Status:** proposed

### S-05: Zarzadzanie uzytkownikami i rolami przez admina

- **Outcome:** admin can manage users and assign roles for operations.
- **Change ID:** admin-manage-users-and-roles
- **PRD refs:** FR-010, Access Control
- **Prerequisites:** S-01, F-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez tego kroku role manager/admin beda wymagaly recznej obslugi w bazie, co podnosi ryzyko operacyjne i opoznia zmiany organizacyjne.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for /10x-plan | Notes |
|---|---|---|---|---|
| F-01 | booking-domain-foundation | Foundation: booking domain contract and availability consistency | yes | Odblokowuje S-03 i S-02. |
| F-02 | admin-access-foundation | Foundation: role access contract for client/manager/admin | yes | Odblokowuje S-02, S-04 i S-05 od strony uprawnien. |
| S-01 | client-auth-journey | Client can sign up and sign in for protected booking flow | yes | Rownolegly szybki tor. |
| S-03 | browse-classes-with-availability | Client can browse classes with availability | no | Wymaga F-01. |
| S-02 | reserve-class-with-guardrails | Client can reserve class and see upcoming reservation | no | North star; wymaga S-01, S-03, F-01, F-02. |
| S-04 | manager-manage-classes-and-attendees | Manager can manage classes and attendees | no | Wymaga S-01, F-01, F-02. |
| S-05 | admin-manage-users-and-roles | Admin can manage users and assign roles | no | Wymaga S-01 i F-02. |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. Include one row for every F-NN and S-NN. It should be compact enough to copy into issues, but it must not duplicate the detailed roadmap body.

## Open Roadmap Questions

1. **None at this stage.** — Owner: user. Block: roadmap-wide.

## Parked

- **FR-006: client can cancel a reservation.** Why parked: w PRD ma priorytet nice-to-have; przy main_goal speed i top_blocker time pierwszenstwo ma sciezka must-have.
- **Online payments.** Why parked: PRD Non-Goals.
- **Memberships and class-package billing.** Why parked: PRD Non-Goals.
- **Multi-club support.** Why parked: PRD Non-Goals.
- **Mobile native app.** Why parked: PRD Non-Goals.

## Done

(Empty on first generation. /10x-archive appends an entry here - and flips that item's Status to done - when a change whose Change ID matches the item is archived. Do NOT pre-populate. Format:)

- **F-02: (foundation) reguly dostepu dla roli client/manager/admin sa gotowe dla operacji rezerwacji, zarzadzania grafikiem i zarzadzania uzytkownikami.** - Archived 2026-07-29 -> `context/archive/2026-06-30-admin-access-foundation/`. Lesson: —.

- **<Slice ID>: <Outcome>** - Archived <YYYY-MM-DD> -> context/archive/<YYYY-MM-DD-change-id>/. Lesson: <pointer to lessons.md if any, or ->.
