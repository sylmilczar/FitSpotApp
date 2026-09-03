# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-08-30

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the risk
   wins. Do not promote to e2e because e2e "feels safer." The rollout is
   unit-first and permits exactly one illustrative E2E flow.
2. **User concerns are first-class evidence.** The risks around invalid
   bookings and unsafe manager edits came directly from the user and rank with
   PRD requirements and hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents what
   could fail and why it is likely. It does not claim which line owns a
   failure; `/10x-research` establishes that before any test is planned.

Hot-spot scope used for likelihood weighting: `src/`. Test-base profile:
none; no test runner, test configuration, or test files were found.

## 2. Risk Map

The top failure scenarios are ordered by impact × likelihood. Sources are
evidence, not implementation anchors.

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence - not anchor) |
|---|---|---|---|---|
| 1 | A client receives a confirmed reservation for a full, duplicate, started, or cancelled class. | High | High | PRD Guardrails and FR-005; booking and reservation archived plans; interview Q1 |
| 2 | A manager lowers capacity or changes a class time in a way that conflicts with existing reservations. | High | High | PRD FR-008; interview Q1 and Q3; hot-spot dir `src/pages` (24 changes/30d) |
| 3 | A logged-in user can read or mutate another user's reservation, or access staff operations without the required role. | High | Medium | PRD Access Control; admin-access archived plan; hot-spot dir `src/lib` (8 changes/30d) |
| 4 | Invalid class dates, capacities, or form values reach persistence despite browser-side validation. | High | High | PRD FR-008; interview Q3; hot-spot dir `src/components` (17 changes/30d) |
| 5 | Login does not return a client safely to the selected class and the reservation flow cannot be completed. | Medium | Medium | PRD US-01; auth and routing archived plans; hot-spot dir `src/pages` (24 changes/30d) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | Each forbidden booking produces no confirmed reservation and a stable outcome. | Hiding an action in the UI protects every caller. | Write boundary, persisted reservation state, guardrail outcomes, authenticated context. | unit + contract | Happy-path-only assertions or copied production calculations. |
| #2 | A manager cannot persist a lower limit or incompatible time when reservations make it unsafe. | A valid form submission implies a safe mutation. | Mutation entry point, existing-count source, time constraint, result mapping. | unit | Mirroring validation internals instead of asserting rejected behavior. |
| #3 | A caller without ownership or role cannot observe or perform the protected operation. | Authentication alone establishes authorization. | Session and role shape, ownership boundary, database and route enforcement. | unit + contract | Over-mocking the authorization boundary. |
| #4 | Malformed, past, or insufficient-capacity input is rejected server-side with stable feedback. | Browser constraints ensure valid submitted input. | Form normalization, server validation, persistence boundary, error transport. | unit | Assertions derived from the current parser implementation. |
| #5 | A client signs in, returns only to a safe in-app destination, reserves an eligible class, and sees the outcome. | Unit tests alone prove cookie/session and redirect behavior together. | Auth state setup, redirect propagation, eligible fixture, visible post-booking result. | one e2e | Adding multiple E2E variants where units cover the guardrail. |

## 3. Phased Rollout

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Unitowe kontrakty rezerwacji i walidacji | Prove that unsafe bookings and manager inputs are rejected at the cheapest layer. | #1, #2, #3, #4 | unit + focused contract | change opened | testing-booking-validation-contracts |
| 2 | Jeden krytyczny przeplyw E2E | Prove the safe login-to-reservation journey once across the real browser boundary. | #5, #1 | one e2e | not started | — |
| 3 | Minimalne bramki testowe | Provide one repeatable local command for the unit suite and single E2E. | cross-cutting | scripts + gates | not started | — |

## 4. Stack

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + focused contract | Vitest | none yet | Add in Phase 1; aligned with Astro/Vite. |
| API mocking | none by default | n/a | Prefer direct pure contracts or local Supabase boundaries; mock only external edges. |
| e2e | Playwright | none yet | Add one representative flow in Phase 2; do not add further scenarios without refresh. |
| accessibility | none | n/a | Outside this minimal rollout. |
| AI-native | none | n/a | Do not use: deterministic unit/E2E checks provide the required signal. |

**Stack grounding tools (current session):**
- Docs: none - no technical docs MCP exposed; checked: 2026-08-30
- Search: none - no search MCP exposed; checked: 2026-08-30
- Runtime/browser: Playwright browser tool - available for the one E2E only; checked: 2026-08-30
- Provider/platform: none - no provider MCP exposed; checked: 2026-08-30

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + typecheck | local + CI | required | syntax and type drift |
| unit + focused contract | local + CI | required after §3 Phase 1 | domain, validation, and authorization regressions |
| one critical E2E | local + CI | required after §3 Phase 2 | login, session, redirect, and booking-path integration failure |
| visual snapshots | nowhere | not planned | excluded by interview Q5 |
| multimodal visual review | nowhere | not planned | no cheaper signal than the selected checks |

## 6. Cookbook Patterns

### 6.1 Adding a unit test

TBD - see §3 Phase 1 for booking, authorization, and manager validation patterns.

### 6.2 Adding a focused contract test

TBD - see §3 Phase 1 for persisted reservation and access-boundary behavior.

### 6.3 Adding an e2e test

TBD - see §3 Phase 2 for the single login-to-reservation pattern. Do not add another E2E without a risk-based refresh.

### 6.4 Adding a test for a new API endpoint

TBD - see §3 Phase 1 for server-side validation and authorization patterns.

### 6.5 Per-rollout-phase notes

TBD - populated as rollout phases ship.

## 7. What We Deliberately Don't Test

- **Public-page visual details and UI snapshots** - they are excluded as low-signal churn. Re-evaluate only after a visual regression becomes a product risk. (Source: interview Q5.)
- **Additional full E2E flows** - exactly one example E2E is permitted; unit or focused contract tests must cover equivalent risks. Re-evaluate when a new critical browser-only workflow appears. (Source: interview Q5.)
- **AI-native test layers** - no use case adds signal beyond the selected deterministic checks. Re-evaluate if the product gains DOM-unreachable or visual-critical behavior. (Source: cost × signal.)

## 8. Freshness Ledger

- Strategy (§1-§5) last reviewed: 2026-08-30
- Stack versions last verified: 2026-08-30
- AI-native tool references last verified: 2026-08-30

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework or test runner),
- §7 negative-space no longer matches what the team believes.