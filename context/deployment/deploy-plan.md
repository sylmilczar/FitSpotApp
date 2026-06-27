# Deploy Plan: First Deploy — Cloudflare → Vercel Migration + Production Deploy

**Date:** 2026-06-27
**Platform:** Vercel (per infrastructure.md)
**Stack:** Astro 7 + React 19 + Supabase (external)
**Workflow:** Development branch (local Supabase) → Main branch (production Supabase + Vercel)

## Context

- Codebase is wired for Cloudflare Workers (`@astrojs/cloudflare`, `wrangler.jsonc`)
- Decision: follow `infrastructure.md` and deploy to Vercel
- Strategy: test locally on `development` branch with `npx supabase start`, then merge to `main` for production

---

## Phase 0 — Local Development Setup (development branch) ✅ COMPLETED

**Completed:** 2026-06-27 at 19:30 UTC

1. ✅ `git checkout -b development` — create development branch
2. ✅ `npm install` — ensure dependencies are up to date
3. ✅ Install Supabase CLI: `brew install supabase/tap/supabase` (macOS) or follow [docs](https://supabase.com/docs/guides/cli/getting-started)
4. ✅ `npx supabase start` — boots local Supabase instance (Docker required; runs on `localhost:54321`)
5. ✅ `npx supabase db reset` — recreates local database from version-controlled migrations in `supabase/migrations/`, ensuring a clean and reproducible development environment
6. ✅ `npm run dev` — start Astro dev server on `localhost:4321`, test against local Supabase
7. ✅ Test locally:
   - ✅ Sign-up, sign-in, access `/dashboard`, sign-out
   - ✅ Verify user appears in local Supabase Auth dashboard
   - ✅ Session persistence confirmed (refresh keeps user logged in)
   - ✅ Protected routes redirect unauthenticated users to `/auth/signin`

---

## Phase 1 — Adapter Migration (development branch) ⏳ IN PROGRESS

**Status:** Ready to start

8. `npm install @astrojs/vercel`
9. Edit `astro.config.mjs`:
    - `import cloudflare from "@astrojs/cloudflare"` → `import vercel from "@astrojs/vercel"`
    - `adapter: cloudflare()` → `adapter: vercel()`
10. `npm uninstall @astrojs/cloudflare` — remove obsolete adapter
11. Clean up unused Cloudflare config (optional but recommended):
    ```bash
    rm wrangler.jsonc
    ```
12. `npm run build` — validate the build succeeds with new adapter
13. Test the built app locally: `npm run preview`
14. Commit changes: `git add -A && git commit -m "feat: migrate from Cloudflare to Vercel adapter"`

---

## Phase 2 — Merge & Production Supabase Setup (main branch) ⬜ NOT STARTED

15. `git checkout main && git merge development` — merge adapter changes to main
16. Go to https://supabase.com → New project (separate from dev) → note **Project URL** and **Project Ref**
17. In Supabase dashboard: **Authentication → URL Configuration** → set Site URL to a placeholder; update to production URL after deploy
18. Apply migrations to production Supabase using CLI:
    ```bash
    npx supabase link --project-ref <your-prod-project-ref>
    npx supabase db push
    ```
    This applies all migrations from `supabase/migrations/` to the empty production database.

---

## Phase 3 — Vercel Project Setup (main branch) ⬜ NOT STARTED

19. `npx vercel login` — authenticate with Vercel account
20. `npx vercel link` — links local project; creates `.vercel/project.json` (already in `.gitignore`)
21. Set production secrets using the Supabase project created in Phase 2:
    ```bash
    npx vercel env set SUPABASE_URL "https://your-prod-project.supabase.co"
    npx vercel env set SUPABASE_KEY "your-prod-anon-key"
    ```
22. `npx vercel env pull .env.local` — verify secrets are injected correctly

---

## Phase 4 — Production Deploy (main branch) ⬜ NOT STARTED

23. `npx vercel deploy` — deploys to a preview URL; manually test:
    - Sign-up flow
    - Sign-in flow
    - Dashboard (protected route — must redirect when unauthenticated)
    - Sign-out
24. `npx vercel deploy --prod` — production deploy after preview verification passes
25. Update Supabase **Site URL** to the production Vercel URL (**Authentication → URL Configuration**)

---

## Relevant Files

| File | Role |
|---|---|
| `astro.config.mjs` | Adapter swap — only code file that changes |
| `package.json` | Adapter dependency |
| `.gitignore` | Now includes `.vercel/` (already updated) |
| `src/middleware.ts` | Uses `@supabase/ssr` (isomorphic, safe on Vercel serverless) |
| `src/lib/supabase.ts` | Reads env via `astro:env/server`: `SUPABASE_URL` and `SUPABASE_KEY` |
| `wrangler.jsonc` | Removed after migration (via `rm wrangler.jsonc`) |
| `supabase/migrations/` | Version-controlled database migrations applied locally via `supabase db reset` and to production via `supabase db push` |
| `supabase/config.toml` | Local Supabase config (used by `npx supabase start`) |

---

## Verification Checklist

### Phase 0 (Local Development)
- [ ] `npx supabase start` runs without Docker errors
- [ ] `npx supabase db reset` recreates local database from migrations successfully
- [ ] `npm run dev` connects to local Supabase
- [ ] Sign-up creates user in local Supabase Auth
- [ ] Sign-in/sign-out flow works locally
- [ ] `/dashboard` redirects when unauthenticated

### Phase 1 (Adapter + Build)
- [ ] `npm run build` passes with Vercel adapter
- [ ] `npm run preview` loads homepage locally
- [ ] `wrangler.jsonc` removed

### Phase 2 (Production Supabase)
- [ ] Production Supabase project created
- [ ] `npx supabase db push` applies migrations to production successfully
- [ ] Production Supabase Auth dashboard is accessible

### Phase 4 (Production)
- [ ] Preview URL loads homepage
- [ ] Sign-up creates a user visible in production Supabase Auth
- [ ] Sign-in redirects to `/dashboard`
- [ ] Unauthenticated access to `/dashboard` redirects to `/auth/signin`
- [ ] Refreshing the page while authenticated keeps the user session active
- [ ] Sign-out returns to homepage
- [ ] Production URL loads correctly after `vercel deploy --prod`
- [ ] Supabase Site URL updated to production URL

---

## Post-Deploy (Optional)

After verifying production is working:

- Set up GitHub auto-deploy: `npx vercel git connect` — enables automatic deployments on push to `main` and preview URLs for PRs
- Delete development branch: `git checkout main && git branch -d development` (after final verification)
- Enable Supabase connection pooling if load testing shows connection pool exhaustion

---

## Out of Scope

- Custom domain / SSL — post-launch, one-click in Vercel dashboard
- Advanced CI/CD pipeline — not blocking first deploy
- Supabase advanced features (RLS fine-tuning, connection pooling, backups) — post-launch steps
- Multi-region / HA — beyond MVP scope
