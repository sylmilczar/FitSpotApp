---
change_id: testing-booking-validation-contracts
title: Unit booking and validation contracts
status: implementing
created: 2026-08-30
updated: 2026-08-30
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Unitowe kontrakty rezerwacji i walidacji".
Risks covered: #1, #2, #3, #4. Test types planned: unit + focused contract.
Risk response intent:

- #1: prove forbidden bookings create no confirmed reservation and return a stable outcome.
- #2: prove unsafe capacity or time updates cannot be persisted when reservations exist.
- #3: prove ownership and privileged-role checks reject unauthorized callers.
- #4: prove invalid dates, capacities, and form values are rejected server-side.
  After creating the folder, follow the downstream continuation rule.
