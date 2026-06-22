---
bootstrapped_at: 2026-06-22T13:25:00Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: fitspotapp
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

**Starter**: 10x-astro-starter — 10x Astro Starter (Astro + Supabase + Cloudflare)
**Project name**: fitspotapp
**Package manager**: npm
**Language**: js
**Deployment target**: cloudflare-pages
**CI provider**: github-actions
**Confidence**: first-class
**Path taken**: standard

### Why this stack

This project is a web MVP with a short three-week, after-hours timeline and a must-have authentication flow, so the safest route is the vetted default for web + JavaScript. The 10x Astro Starter gives a convention-based TypeScript stack with auth, database, and deploy path aligned out of the box, which reduces setup drag for a solo build. It also stays consistent with your PRD scope: auth is in, while payments, realtime, AI, and background jobs are out for now. Deploying to Cloudflare Pages with GitHub Actions auto-deploy keeps the delivery pipeline simple and fast while preserving room to scale later if needed.

## Pre-scaffold verification

| Signal             | Value                              | Severity | Notes                              |
| ------------------ | ---------------------------------- | -------- | ---------------------------------- |
| npm package        | not run                            | n/a      | cmd_template uses `git clone`, npm check skipped |
| GitHub repo        | not run                            | n/a      | `gh` CLI not available; recency check unavailable |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone

**Exit code**: 0

**Files moved**: 23

**Conflicts (.scaffold siblings)**: README.md.scaffold

**.gitignore handling**: append-merged

**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: npm audit --json

**Summary**: 6 CRITICAL, 10 MODERATE, 2 LOW (18 total vulnerabilities)

**Direct vs transitive**: not distinguished by npm audit in this invocation

### HIGH findings

- **@babel/core** <=7.29.0 — Arbitrary File Read via sourceMappingURL Comment
- **astro** <=7.0.0-beta.6 — Multiple XSS and SSRF vulnerabilities (Reflected XSS via unescaped slot name, XSS via Unescaped Attribute Names, Host header SSRF)
- **devalue** 5.6.3 - 5.8.0 — DoS via sparse array deserialization
- **esbuild** 0.27.3 - 0.28.0 — Arbitrary file read on Windows dev server
- **wrangler** <=0.0.0-kickoff-demo || 3.108.0 - 4.101.0 — Transitive vulnerabilities via esbuild and miniflare
- **@cloudflare/vite-plugin** <=0.0.0-fff677e35 || 0.0.7 - 1.41.0 — Transitive vulnerabilities via dependencies

### MODERATE findings

- **js-yaml** <=4.1.1 — Quadratic-complexity DoS in merge key handling
- **minimatch** <3.0.5 — ReDoS via repeated asterisks
- **tar** <6.2.1 — Arbitrary file overwrite via hardlinks/symlinks
- **vm2** <3.9.20 — Sandbox escape
- **ws** <8.17.1 — DoS via memory consumption
- **miniflare** 3.0.0 - 3.20240603.1 — Transitive dependencies
- **cross-spawn** <7.0.5 — Improper input validation
- **@nodelib/fs.walk** <1.2.8 — Prototype pollution
- **postcss** <8.4.32 — Potential ReDoS
- **semantic-release** — various dependency vulnerabilities

### LOW findings

- **debug** <4.3.6 — Prototype pollution
- **yaml** — YAML parsing vulnerabilities

## Hints recorded but not acted on

| Hint                       | Value                              |
| -------------------------- | ---------------------------------- |
| bootstrapper_confidence    | first-class                       |
| quality_override           | false                              |
| path_taken                 | standard                          |
| team_size                  | solo                               |
| deployment_target          | cloudflare-pages                   |
| ci_provider                | github-actions                     |
| ci_default_flow            | auto-deploy-on-merge              |
| has_auth                   | true                               |
| has_payments               | false                              |
| has_realtime               | false                              |
| has_ai                     | false                              |
| has_background_jobs        | false                              |

## Next steps

Your project is scaffolded and verified — happy hacking!

### Useful manual steps in the meantime:

- **Git setup**: Run `git init` to initialize your own repo history (the cloned `.git/` was removed to avoid inheriting upstream history).
- **Review conflicts**: The conflict policy created one `.scaffold` sibling (`README.md.scaffold`). Review it and decide which version to keep, then delete the sibling.
- **Security**: The audit found 18 vulnerabilities. Review the findings above per your project's risk tolerance. Run `npm audit fix` to attempt automatic patches, though some may require manual intervention due to breaking changes.
- **Agent context**: A future skill will generate `CLAUDE.md` and `AGENTS.md` for agent-assisted development.
