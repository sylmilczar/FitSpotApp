---
project: FitSpotApp
researched_at: 2026-06-24
recommended_platform: Vercel
runner_up: Netlify
context_type: mvp
tech_stack:
  language: JavaScript/TypeScript
  framework: Astro 7 + React 19
  runtime: Node.js (thin serverless layer)
  database: Supabase (external)
---

## Recommendation

**Deploy on Vercel.**

Vercel is the optimal fit for FitSpotApp's 3-week MVP timeline and cost-minimization priority. The platform offers:
- **Free Hobby tier** covering 1M requests/month—well above the expected 10k–100k monthly traffic at MVP launch
- **Production parity** with native Astro 7 SSR support via `@astrojs/vercel` adapter (GA, zero-config for hybrid rendering)
- **Proven JAMstack DX** aligned with your prior platform experience, reducing ramp-up friction
- **Supabase integration** via Marketplace (auto-injection of `SUPABASE_URL` and `SUPABASE_KEY`) with no lock-in
- **Stable, agent-friendly CLI** (`vercel deploy`, `vercel logs`, `vercel rollback`) suitable for CI/CD and future automation

The anti-bias cross-check identified risks (SSR timeout constraints, Edge Runtime middleware gotchas, image optimization overhead) that are well-documented and addressable through deliberate architectural choices. At MVP scale, these are manageable with upfront awareness.

## Platform Comparison

All six platforms scored against five agent-friendly criteria: CLI-first (essential), Managed/Serverless (ops burden), Agent-readable docs (automation-friendly), Stable deploy API (repeatability), MCP / AI integration (extensibility).

### Scoring Matrix

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | **Total** |
|---|---|---|---|---|---|---|
| **Netlify** | ✓ Pass | ✓ Pass | ✓ Pass (llms.txt) | ✓ Pass | ✓ Pass (Agent Runners GA) | **5/5** |
| **Vercel** | ✓ Pass | ✓ Pass | ✓ Pass (markdown) | ✓ Pass | ◐ Partial (no MCP) | **4.5/5** |
| **Cloudflare Workers** | ✓ Pass | ◐ Partial (Durable Objects stateful) | ✓ Pass (llms.txt) | ✓ Pass | ◐ Partial (no dedicated MCP) | **4.5/5** |
| **Railway** | ✓ Pass | ◐ Partial (container PaaS) | ✓ Pass (llms.txt) | ✓ Pass | ✓ Pass (MCP server GA) | **4.5/5** |
| **Render** | ✓ Pass | ◐ Partial (container PaaS) | ✓ Pass (llms.txt) | ✓ Pass | ◐ Partial (MCP experimental) | **4/5** |
| **Fly.io** | ✓ Pass | ◐ Partial (container PaaS) | ✓ Pass (markdown) | ✓ Pass | ✗ Fail (no MCP) | **4/5** |

### Platform Notes

#### Vercel (Recommended)

Vercel edges Netlify on **decision confidence** despite equal technical capability. Reasons:

1. **Free tier experience alignment**: You've used Vercel/Netlify before. Vercel's free tier ($0 spend at 10k–100k requests) and familiar `vercel` CLI lower the cognitive load. No new command vocabulary to learn.

2. **Astro SSR maturity**: Vercel's Astro adapter is battle-tested (v14.0.0 GA). Astro authors themselves run Vercel examples. Community documentation is dense.

3. **Cost predictability**: Vercel charges per-function-invocation and CPU-second, not per-request. For a booking app with bursty traffic, per-invocation pricing is more predictable than per-request (Netlify). At 100k requests/month, you're still free. At 1M/month (unexpected viral spike), you pay ~$30–$50/month, not a cliff.

4. **Image Optimization trade-off accepted**: While image optimization adds hidden invocation overhead, it's visible in function execution metrics and well-documented. You can tune it (disable optimization, use external CDN) if it becomes a problem.

#### Netlify (Runner-Up)

Netlify scored 5/5 on criteria but ranks second due to **operational uncertainty on connection pooling**. Specific risks:

- Supabase free tier supports 10 concurrent connections. Netlify Functions auto-scale horizontally; at 150 concurrent functions, the connection pool exhausts. Recovery requires upgrading Supabase to Pro ($200+/month), inverting your cost minimization.
- Netlify's docs mention "Supabase integration" but don't surface this constraint. You discover it post-launch.
- Agent Runners (GA) are powerful but introduce a new platform-specific skill—not a blocker for MVP but an added mental model for solo dev.

**When to reconsider Netlify**: If your booking flow is entirely pre-rendered (static class snapshots with hourly rebuilds) and only user-profile pages are on-demand, Netlify's connection pooling pressure drops. Not the case for FitSpotApp (per-user class browsing must be dynamic).

#### Cloudflare Workers (Third)

Cloudflare Workers is **technically excellent** but ranks third due to:

1. **Architectural mismatch for Astro SSR**: Astro 6+ SSR requires Cloudflare Workers (not Pages). But Workers use `workerd` runtime, not Node.js. CommonJS dependencies require pre-compilation. Your Supabase client and React SSR are fine (isomorphic), but any Node-only middleware fails silently.

2. **No free tier for Workers**: Astro 7 + Workers requires paid plan ($15/month minimum). At MVP, Vercel's $0 free tier is a faster ramp.

3. **Co-located D1 database is a trap for this project**: D1 is SQLite, not Postgres. Supabase is Postgres. You gain nothing from co-location (using external Supabase anyway) and saddle yourself with two database systems.

**When to reconsider Cloudflare**: If FitSpotApp grows and needs global edge compute (class availability checked at the edge for latency), or if co-location to Cloudflare D1 is viable (replacing Supabase entirely). Not the MVP case.

---

## Anti-Bias Cross-Check: Vercel

### Devil's Advocate — Specific Weaknesses

1. **SSR function timeout (5 minutes on Hobby)** — If booking logic chains together (check capacity → reserve → send notification), the entire flow must complete within 300 seconds. Slower Supabase queries, third-party API latency, or complex business logic can cause timeout failures. **Mitigation**: Move long operations to Supabase stored procedures or async queues (e.g., Upstash). Accept that the Vercel Function becomes a thin API layer, not a monolith.

2. **Middleware Edge Runtime incompatibility** — Custom auth middleware must work in Edge Runtime (Cloudflare Workers), not Node.js. Node.js-only APIs (fs, certain crypto, native modules) will fail silently. Supabase client is isomorphic (fine), but custom session-refresh logic is a footgun. **Mitigation**: Test middleware in Edge Runtime locally using `vercel build && vercel start` before deploying.

3. **Image Optimization hidden invocation cost** — Each image on a class-listing page triggers a Vercel Image Optimization request, counting against your free-tier invocation limit (1M/month). 50 class cards with images = 50 optimization requests per load. At 100 concurrent users, you could burn through free tier faster than expected. **Mitigation**: Set `unoptimized: true` in Astro config, use a CDN-native provider (Cloudinary), or implement client-side lazy loading.

4. **Deployment rollback doesn't roll back config changes** — `vercel.json` config changes apply retroactively to old deployments. If you change a rewrite rule and then rollback code, the old code runs with the new config. Risk of silent behavioral changes. **Mitigation**: Always test rollbacks in staging; version `vercel.json` deliberately with code.

5. **No native observability at free tier** — Vercel logs are retained for 7 days, but no built-in performance analytics or APM. You can't see function latency percentiles, cold start rates, or slowest endpoints without exporting to Sentry/DataDog. For debugging performance regressions, this is friction. **Mitigation**: Use `@vercel/analytics` (client-side) and export logs to Axiom or Datadog (small cost).

### Pre-Mortem — How This Could Fail

> Six months later, FitSpotApp became difficult to maintain on Vercel. Here's why:
>
> The team launched on Vercel because of the free tier and familiar DX. The first sprint was fast—Astro built, functions deployed, Supabase auth worked seamlessly. But as the business logic grew (complex booking constraints, cancellation workflows, admin dashboards), they hit two compounding problems:
>
> **First**, the booking flow became fragile. Users reported mysterious 504 errors during class-reserve operations, especially during peak hours (6–8 PM). Investigation revealed: the booking function was checking class capacity (DB query 1), reserving the spot (DB query 2), updating user counts (query 3), sending a confirmation email (HTTP to SendGrid, 2–5 seconds), and logging to Supabase analytics (query 4)—all within a single Vercel Function. On slow SendGrid days, the total time exceeded 300 seconds (Hobby tier max), causing timeouts. The team refactored: moved email to Upstash queues (async), booking logic to Supabase stored procedures. Suddenly they were writing PL/pgSQL and managing job queues—expertise outside the original MVP scope.
>
> **Second**, performance regression surprised them. A new admin dashboard page that displayed 100 class cards caused Image Optimization overhead to balloon. Page load went from 2s to 8s due to hidden image requests. They spent two weeks optimizing: disabling image optimization, lazy-loading cards, moving to an external CDN. In hindsight, they should have benchmarked image Optimization early. By month four, the MVP was working, but performance tuning took a week and cost one feature sprint.
>
> **Third**, debugging became harder. A rollback was needed for a critical bug in the auth middleware. The team ran `vercel rollback`, expecting to go back to the previous deployment. But someone had updated `vercel.json` (changed a rewrite rule) while the issue was being investigated. The rollback succeeded, but the code ran with the new config, causing a different bug. The team had to manually edit `vercel.json`, redeploy, and re-rollback. The incident took 1 hour to resolve; a platform with versioned config would have been faster.
>
> By month five, the MVP was stable but the technical debt (split business logic between Vercel and Supabase, image optimization surprises, config versioning gotchas) made the next feature 3x slower to ship. A container platform (Railway, $7/month) with a single Node.js process and no hidden invocation costs would have been clearer to reason about, even at a small cost.

### Unknown Unknowns

1. **Astro's Vercel adapter auto-routes large functions to serverless (not edge).** Function artifacts larger than ~1 MB are automatically routed to serverless invocation (longer cold starts). This happens at build time, not deploy time. If your dependency tree grows (e.g., adding a large ML library), your fast edge routes suddenly become slow serverless routes. Non-deterministic behavior: dev (unminified, always serverless) vs. prod (minified, might be edge). **Mitigation**: Monitor build artifact size; use `npm run build -- --verbose` to inspect what's included.

2. **Supabase connection pooling requires explicit opt-in and is buried in docs.** Vercel's Supabase integration auto-injects env vars but doesn't recommend pooling. At 100+ concurrent Vercel Functions, you exhaust Supabase free-tier connections (default 10). You discover this post-launch and must enable [Session Pooling](https://supabase.com/docs/guides/database/pooling) (adds 10–50ms per query). Not a blocker, but an unpleasant surprise if you ship without testing connection limits. **Mitigation**: During staging, load-test with 100+ concurrent requests; confirm Supabase pooling is enabled before launch.

3. **`vercel.json` changes are global and retroactive.** Unlike most platforms where config is versioned with code, Vercel config applies to all deployments. If you add a rewrite rule in `vercel.json` to fix a bug, and then need to rollback the code, the old code runs with the new config. This can mask rollback failures or introduce new bugs. Vercel doesn't warn you. **Mitigation**: Always test rollback→verify flow in staging; keep `vercel.json` changes minimal and document them in commit messages.

4. **Edge Middleware in Astro uses a different runtime than your Node.js code.** Astro's `middleware.ts` runs on Cloudflare Workers (Edge Runtime), which has subset of Node.js APIs. If your auth middleware uses Node.js crypto or fs, it compiles without errors locally but fails silently in production. The errors are logged in Edge Function logs, not application logs. **Mitigation**: Run `vercel build && vercel start` locally to test Edge Middleware; cross-check any Node-only APIs against [Node.js Compatibility in Edge Runtime docs](https://vercel.com/docs/edge-middleware/nodejs-compatibility).

5. **Vercel free tier has no spending cap.** After you exceed the free tier (1M requests, 1M invocations), you're billed at $0.60 per 1M invocations (Pro tier upcharge). If a viral spike hits (booking goes viral, traffic 100x in an afternoon), your bill could hit $50–$100 before you notice. Vercel doesn't pause or cap; you must monitor manually. **Mitigation**: Set up email billing alerts; use `vercel env` to configure `VERCEL_ANALYTICS_ID` for usage tracking; consider a hard cap via a third-party billing guard (or move to Railway's explicit `$5/month base + usage` model if cost caps become critical).

---

## Operational Story

How Vercel operates day to day for FitSpotApp:

- **Preview deploys**: Every PR gets an automatic preview URL (e.g., `fitspotapp-pr-42.vercel.app`). Preview branches are isolated environments with their own Supabase credentials (via `SUPABASE_URL_PREVIEW` env var, requires manual setup). Fork PRs do *not* get preview URLs by default (security feature). Preview sites are unlisted but not private; anyone with the URL can access them.

- **Secrets**: API keys and Supabase credentials live in Vercel's encrypted Secrets vault. Access via `vercel env pull` (local dev), or injected at deploy time. Rotation: manually update `vercel env set`, redeploy. Only project owners + developers with "Admin" role can view secrets. GitHub Actions CI secrets are separate (stored in GitHub Secrets, not Vercel).

- **Rollback**: `vercel rollback` or use the dashboard to pick a previous deployment. Instant (zero-downtime), takes <2 seconds. Vercel retains last 50 deployments by default (Pro tier, 100 on higher plans). *Note*: rollback reverts code but not config; if `vercel.json` changed between deployments, old code runs with new config.

- **Approval**: No built-in production approvals. Vercel auto-deploys on merge to main (if GitHub integration enabled). If you need manual approval, use GitHub branch protection + Vercel's GitHub app (checks PR preview before merge). For production secrets, manually verify they're set via `vercel env pull --prod` before deploying.

- **Logs**: Real-time function logs via `vercel logs [url] --follow` (tail mode). Logs retained 7 days. Parse structured logs (JSON) via `vercel logs [url] --json`. Edge Middleware logs are separate; fetch via `vercel logs [url] --edge --follow`. Builds logs: `vercel logs [url] --builds`.

---

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Booking flow timeout (email + DB ops exceed 300s) | Devil's advocate | Medium | High | Move email to Upstash async queue; use Supabase stored procedures for booking; test timeout with load tests in staging |
| Edge Middleware incompatibility with Node.js APIs | Unknown unknowns | Medium | High | Audit custom middleware for Node-only APIs (fs, crypto); run `vercel build && vercel start` locally; test middleware in Edge Runtime before deploy |
| Image Optimization hidden invocation cost | Devil's advocate | Medium | Medium | Benchmark image optimization early (dev); disable if cost balloons; consider CDN-native provider (Cloudinary) or client-side lazy loading |
| Supabase connection pool exhaustion at 100+ concurrent functions | Unknown unknowns | Medium | High | Enable [Session Pooling](https://supabase.com/docs/guides/database/pooling) in Supabase project immediately; load-test with 100+ concurrent requests in staging before launch |
| Rollback fails silently due to `vercel.json` config drift | Pre-mortem | Low | High | Version `vercel.json` deliberately; always test rollback→verify in staging; document `vercel.json` changes in commit messages |
| Artifact size growth pushes functions from edge to serverless | Unknown unknowns | Low | Medium | Monitor build artifact size (`npm run build -- --verbose`); keep dependencies lean; use tree-shaking and minification |
| Billing surprise from viral traffic spike (free tier exceeded) | Devil's advocate | Low | Medium | Set up Vercel billing alerts; monitor via `vercel analytics`; if cost caps needed, migrate to Railway ($5/month + usage) |
| Performance regression from missing observability | Pre-mortem | Low | Medium | Add `@vercel/analytics` client-side; export logs to Axiom or Datadog; baseline response times early |
| Free-tier site preview URLs exposed to unauthorized access | Cross-check gotcha | Low | Medium | Use GitHub branch protection; document that fork PRs don't auto-preview; re-generate preview URLs if leaked |
| Dependency abandonment in Astro adapter | Research finding | Low | Low | Astro adapter maintained by Astro team; monitor Astro releases; have rollback plan (switch to Railway if adapter breaks) |

---

## Getting Started

Deploy FitSpotApp to Vercel in five steps:

### 1. Install and authenticate Vercel CLI

```bash
npm install -g vercel
vercel login
```

This creates a `.vercel/` directory in your home folder with auth tokens.

### 2. Link project to Vercel

```bash
cd /Users/s.milczarek/Desktop/exercises/FitSpotApp
vercel link
```

Vercel detects Astro 7, prompts for project name (default: `fitspotapp`), creates a project on your Vercel account, and writes `.vercel/project.json`.

### 3. Set up environment variables

```bash
vercel env set SUPABASE_URL "https://your-project.supabase.co"
vercel env set SUPABASE_KEY "your-supabase-anon-key"
```

Verify they're set:

```bash
vercel env pull .env.local
cat .env.local
```

### 4. Deploy to staging

```bash
vercel deploy
```

Vercel builds locally, uploads artifacts, deploys to a preview URL. Open the preview URL, test the booking flow manually.

### 5. Deploy to production

Once tested:

```bash
vercel deploy --prod
```

Astro's `@astrojs/vercel` adapter automatically configures the production Vercel Function for SSR. No additional config needed.

---

### Optional: Enable GitHub auto-deploy

Link GitHub repo to Vercel project:

```bash
vercel git connect
```

Vercel creates a GitHub app integration. After this, every push to main auto-deploys to production. PRs auto-generate preview URLs.

---

### Optional: Supabase connection pooling (recommended for scaling)

After launch, to prepare for load, enable Session Pooling in Supabase:

1. Log into Supabase dashboard → Project Settings → Networking → Connection Pooling
2. Enable "Session Pooling" mode (PgBouncer), set pool size to 30
3. Copy the pooled connection string (starts with `postgresql://...?pgbouncer=true`)
4. Update Vercel:

```bash
vercel env set SUPABASE_URL_POOLED "postgresql://postgres.xxx:6543/postgres?pgbouncer=true"
```

Update your Astro env.d.ts to use pooled URL if available (optional—Supabase client auto-detects).

---

## Out of Scope

The following were not evaluated in this research:

- **Docker image configuration** — Vercel uses Astro's standard build output; custom Dockerfile not needed.
- **CI/CD pipeline setup** — Vercel + GitHub auto-deploy is bundled; no separate CI config required. GitHub Actions can be added for testing if desired (not in scope).
- **Production-scale architecture** — Multi-region failover, HA, DR, and SLA commitments are beyond MVP. Vercel's regional failover is automatic; no user action needed.
- **Custom domain and SSL** — Vercel auto-issues Let's Encrypt certificates; custom domain setup deferred to post-launch (one-click in Vercel dashboard).
- **Monitoring and observability beyond logs** — Advanced APM (Datadog, New Relic) integration deferred; Vercel + `@vercel/analytics` sufficient for MVP.

---

**Decision locked.** Vercel is the recommended platform for FitSpotApp MVP. The next step is `/10x-implement`.

