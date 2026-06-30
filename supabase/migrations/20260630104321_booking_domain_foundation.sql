-- Booking domain foundation
-- NOTE: RLS is intentionally deferred to a follow-up migration after F-02.

create type public.reservation_status as enum ('confirmed', 'cancelled');

create table public.classes (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	description text,
	capacity integer not null check (capacity > 0),
	starts_at timestamptz not null,
	created_at timestamptz not null default now()
);

create table public.reservations (
	id uuid primary key default gen_random_uuid(),
	class_id uuid not null references public.classes(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete cascade,
	status public.reservation_status not null,
	created_at timestamptz not null default now()
);

create unique index reservations_unique_confirmed_per_user
	on public.reservations (class_id, user_id)
	where status = 'confirmed';

create index reservations_by_class_status_idx
	on public.reservations (class_id, status);

create index classes_starts_at_idx
	on public.classes (starts_at);

create or replace function public.create_reservation(p_user_id uuid, p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_capacity integer;
	v_starts_at timestamptz;
	v_confirmed_count integer;
begin
	select c.capacity, c.starts_at
	into v_capacity, v_starts_at
	from public.classes c
	where c.id = p_class_id
	for update;

	if not found then
		raise exception 'Class not found';
	end if;

	if v_starts_at <= now() then
		raise exception using message = 'CLASS_STARTED', errcode = 'P0001', detail = 'CLASS_STARTED';
	end if;

	if exists (
		select 1
		from public.reservations r
		where r.class_id = p_class_id
			and r.user_id = p_user_id
			and r.status = 'confirmed'
	) then
		raise exception using message = 'ALREADY_RESERVED', errcode = 'P0001', detail = 'ALREADY_RESERVED';
	end if;

	select count(*)
	into v_confirmed_count
	from public.reservations r
	where r.class_id = p_class_id
		and r.status = 'confirmed';

	if v_confirmed_count >= v_capacity then
		raise exception using message = 'CLASS_FULL', errcode = 'P0001', detail = 'CLASS_FULL';
	end if;

	insert into public.reservations (class_id, user_id, status)
	values (p_class_id, p_user_id, 'confirmed');

	return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.create_reservation(uuid, uuid) to anon, authenticated, service_role;
