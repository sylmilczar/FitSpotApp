# S-04 Admin Access Foundation Handoff

This note describes what S-04 (admin class management) can rely on from F-02 while staying aligned with `context/foundation/ui-design.md`.

## Profiles contract

- Source: `supabase/migrations/20260630120000_admin_access_profiles.sql`
- Table: `public.profiles`
- Columns:
  - `user_id uuid primary key references auth.users(id)`
  - `role public.app_role not null default 'client'`
  - `created_at timestamptz not null default timezone('utc', now())`
  - `updated_at timestamptz not null default timezone('utc', now())`
- Trigger:
  - `on_auth_user_created` calls `public.handle_new_user()`
  - Every newly created auth user gets a `profiles` row with `role = 'client'`

## Promotion pattern

- Default role is always `client`.
- Promotion is explicit SQL update on `public.profiles.role` to `manager` or `admin`.
- Recommended explicit statements:

```sql
update public.profiles
set role = 'manager'
where user_id = '<user-uuid>';

update public.profiles
set role = 'admin'
where user_id = '<user-uuid>';
```

## Role helper

- Helper: `public.get_my_role()`
- Behavior:
  - Reads role from `public.profiles` by `auth.uid()`
  - Returns `public.app_role`
  - Falls back to `'client'` if profile is missing
- Consumer surfaces:
  - Database RLS policies use it for authorization branches
  - App middleware maps profile role to `context.locals.role`

## RLS guarantees

- Source: `supabase/migrations/20260630130000_admin_access_rls.sql`

### classes

- `SELECT`: public readable schedule (`classes_select_all`)
- `INSERT/UPDATE/DELETE`: manager or admin only (`classes_manager_insert/update/delete`)

### reservations

- `SELECT`: clients see own rows only (`reservations_select_own`)
- `SELECT`: manager/admin can read all rows (`reservations_select_manager`)

### profiles

- `SELECT`: users can read only own profile (`profiles_select_own`)

### reservation RPC hardening

- `public.create_reservation(uuid, uuid)` execute is revoked from `PUBLIC` and `anon`.
- Execute remains available to `authenticated` (and service roles).

## Route guard guarantees

- Middleware source: `src/middleware.ts`
- `ADMIN_ROUTES` prefix list includes `/admin`.
- Guard behavior:
  - Unauthenticated on `/admin*` -> redirect to `/auth/signin`
  - Authenticated `client` on `/admin*` -> redirect to `/dashboard`
  - Authenticated `manager` or `admin` on `/admin*` -> guard passes
- `context.locals.role` is available as `client | manager | admin | null` via `src/env.d.ts`.

## UI contract for S-04

- Use calm premium design rules from `context/foundation/ui-design.md`.
- Keep management actions visually restrained and role-aware (clear status labels, no ambiguous access state).
- Preserve accessibility cues for role-based states (not color-only messaging).
