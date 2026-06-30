# S-02/S-03 Booking Outcome to UI-State Handoff

This note defines how downstream slices should map booking contract outcomes to UI states while following `context/foundation/ui-design.md`.

## Contract outcomes

- `ok` (success)
- `CLASS_FULL`
- `ALREADY_RESERVED`
- `CLASS_STARTED`
- `UNKNOWN` (fallback)

## UI-state mapping

- `ok`
  - Show success feedback using semantic success color (`#4F8A5B`) and neutral surface (`#FFFFFF`).
  - Keep primary action button in enabled state for navigation to "upcoming reservations".

- `CLASS_FULL`
  - Show warning state with semantic warning color (`#D7A441`) and explanatory text.
  - Disable reservation primary action for the current class card/detail state.

- `ALREADY_RESERVED`
  - Show informational warning state with semantic warning styling and clear message that reservation already exists.
  - Replace primary action with secondary action (for example: "view my reservations").

- `CLASS_STARTED`
  - Show error/blocked state with semantic error color (`#C95B5B`).
  - Reservation action must remain unavailable for started classes.

- `UNKNOWN`
  - Show generic error state and encourage retry.
  - Use semantic error styling and retain accessibility messaging (not color-only).

## Design constraints for S-02/S-03

- Follow calm premium visual language from `context/foundation/ui-design.md`.
- Use olive accent hierarchy (`#ADB867`, hover `#97A354`, light `#D9DEB8`) for primary interaction states only.
- Maintain WCAG AA contrast and include non-color cues in status messages.
- Keep generous spacing and neutral surfaces; avoid saturated "gym" styling.
