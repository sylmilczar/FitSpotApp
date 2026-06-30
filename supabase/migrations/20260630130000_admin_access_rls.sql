-- Admin access foundation — RLS policies
-- Enables RLS on classes and reservations, adds per-role policies,
-- and tightens the create_reservation() grant by revoking anon.

alter table public.classes enable row level security;
alter table public.reservations enable row level security;
alter table public.profiles enable row level security;

-- ── classes policies ─────────────────────────────────────────────────────────

-- Anyone (anon + authenticated) can browse the public class schedule.
create policy classes_select_all
	on public.classes
	for select
	to anon, authenticated
	using (true);

-- Only manager or admin can create classes.
create policy classes_manager_insert
	on public.classes
	for insert
	to authenticated
	with check (public.get_my_role() in ('manager', 'admin'));

-- Only manager or admin can edit classes.
create policy classes_manager_update
	on public.classes
	for update
	to authenticated
	using (public.get_my_role() in ('manager', 'admin'))
	with check (public.get_my_role() in ('manager', 'admin'));

-- Only manager or admin can delete classes.
create policy classes_manager_delete
	on public.classes
	for delete
	to authenticated
	using (public.get_my_role() in ('manager', 'admin'));

-- ── reservations policies ────────────────────────────────────────────────────

-- Clients can only see their own reservations.
create policy reservations_select_own
	on public.reservations
	for select
	to authenticated
	using (user_id = auth.uid());

-- Managers and admins can see all reservations (attendee view, FR-009).
create policy reservations_select_manager
	on public.reservations
	for select
	to authenticated
	using (public.get_my_role() in ('manager', 'admin'));

-- ── profiles policies ────────────────────────────────────────────────────────

-- Users can read their own profile (middleware role lookup).
create policy profiles_select_own
	on public.profiles
	for select
	to authenticated
	using (user_id = auth.uid());

-- ── grant tightening ─────────────────────────────────────────────────────────

-- PostgreSQL grants EXECUTE to PUBLIC by default for new functions.
-- Revoke from PUBLIC entirely, then keep only the roles that should call this.
revoke execute on function public.create_reservation(uuid, uuid) from public;
revoke execute on function public.create_reservation(uuid, uuid) from anon;
-- authenticated and service_role retain their explicit grants from the booking migration.
