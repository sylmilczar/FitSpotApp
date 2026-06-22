# Repository Guidelines

FitSpotApp is an Astro 7 full-stack SSR application for fitness class bookings, built with React 19 islands, Tailwind 4, Supabase authentication, and deployed to Cloudflare Workers. All pages render server-side by default; React is used only for interactive components.

**Maintenance:** This file is the canonical source of truth for all project rules. CLAUDE.md references this file. Always edit AGENTS.md; never update rules in both files.

## Critical Rules

- **Server-side rendering is mandatory.** All pages export Astro components; they render server-side by default. Mark API routes with `const prerender = false`. Never add `"use client"` or client-side rendering directives—Astro does not support them.
- **Supabase auth uses SSR client with cookies, not tokens.** Middleware resolves the current user from session cookies on every request and attaches to `context.locals.user`. See `@src/middleware.ts` and `@src/lib/supabase.ts`. Never store auth state in React local state for page-level decisions; middleware always runs first.
- **Conditional Tailwind classes require `cn()` helper.** Import from `@/lib/utils` (clsx + tailwind-merge). Do not concatenate class strings. Example: `cn("px-2", isActive && "bg-blue-500")`.
- **Protected routes are enforced in middleware.** Add routes to `PROTECTED_ROUTES` array in `@src/middleware.ts`; unauthenticated requests are redirected to signin automatically.

## Project Structure

- `src/components/` — Astro (static layout) and React (interactive islands). UI components in `src/components/ui/` from shadcn/ui, "new-york" variant.
- `src/pages/` — Astro pages and API routes. Routes are file-based; API endpoints in `src/pages/api/`. See `@src/pages/dashboard.astro` as a protected page example.
- `src/lib/` — Services, helpers, types, and Supabase client. `utils.ts` exports `cn()`.
- `src/middleware.ts` — Runs on every request; resolves user and protects routes.
- `supabase/migrations/` — SQL migrations with RLS. Format: `YYYYMMDDHHmmss_description.sql`.

## Commands

- `npm run dev` — Start dev server (Cloudflare workerd runtime).
- `npm run build` — Production build with SSR.
- `npm run lint` — ESLint with strict type-checking.
- `npm run lint:fix` — Auto-fix lint violations.
- `npm run format` — Prettier (includes astro and tailwindcss plugins).
- `npx astro sync` — Generate TypeScript types (run after adding env variables).

## Coding Conventions

- **Astro components** for static HTML/layout; **React components** for interactive UI (buttons, forms, modals).
- **Naming:** PascalCase for React/Astro components, kebab-case for utility files. Handlers use `feature.handler.ts` pattern (e.g., `booking.handler.ts`, not `bookingHandler.ts`).
- **Path alias:** `@/*` resolves to `./src/*`.
- **API routes:** Export uppercase `GET` / `POST` / etc. Validate input with Zod. No named exports except request handlers.
- **Types:** Shared types in `@/types.ts`; scope-specific types co-located with their module.
- **Supabase migrations:** Enable RLS on all new tables; write granular per-operation, per-role policies.

## Commit Conventions

Use imperative style with lowercase prefixes observed in recent history:
- `fix:` — Bug fixes or corrections.
- `feat:` — New features or files.
- `docs:`, `chore:`, `refactor:` — Documentation, maintenance, restructuring.

Example: `fix: remove deprecated baseUrl from tsconfig`.

## Testing

No test runner is currently configured. When adding tests, use Vitest (pairs well with Astro + Vite) or Playwright for E2E. Run `npm ci` to ensure Node 22.14.0 before any build.

## Deployment & Secrets

Build requires `SUPABASE_URL` and `SUPABASE_KEY` as environment variables (GitHub Actions CI gate checks both). Deployment: `npx wrangler deploy` (Cloudflare Workers, requires `wrangler` auth). Local Supabase: `npx supabase start` (Docker required).
