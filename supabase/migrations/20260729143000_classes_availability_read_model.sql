-- S-03 read model for browsing classes with availability.
-- Exposes aggregate availability through SECURITY DEFINER functions,
-- so anon users can browse class availability without direct reservation access.

create or replace function public.list_upcoming_classes_with_availability()
returns table (
	id uuid,
	name text,
	description text,
	capacity integer,
	starts_at timestamptz,
	confirmed_reservations_count bigint,
	available_spots bigint,
	is_full boolean
)
language sql
security definer
stable
set search_path = public
as $$
	select
		c.id,
		c.name,
		c.description,
		c.capacity,
		c.starts_at,
		count(r.id) as confirmed_reservations_count,
		greatest(c.capacity::bigint - count(r.id), 0) as available_spots,
		count(r.id) >= c.capacity::bigint as is_full
	from public.classes c
	left join public.reservations r
		on r.class_id = c.id
		and r.status = 'confirmed'
	where c.starts_at > now()
	group by c.id, c.name, c.description, c.capacity, c.starts_at
	order by c.starts_at asc;
$$;

create or replace function public.get_class_details_with_availability(p_class_id uuid)
returns table (
	id uuid,
	name text,
	description text,
	capacity integer,
	starts_at timestamptz,
	confirmed_reservations_count bigint,
	available_spots bigint,
	is_full boolean
)
language sql
security definer
stable
set search_path = public
as $$
	select
		c.id,
		c.name,
		c.description,
		c.capacity,
		c.starts_at,
		count(r.id) as confirmed_reservations_count,
		greatest(c.capacity::bigint - count(r.id), 0) as available_spots,
		count(r.id) >= c.capacity::bigint as is_full
	from public.classes c
	left join public.reservations r
		on r.class_id = c.id
		and r.status = 'confirmed'
	where c.id = p_class_id
	group by c.id, c.name, c.description, c.capacity, c.starts_at;
$$;

revoke execute on function public.list_upcoming_classes_with_availability() from public;
revoke execute on function public.get_class_details_with_availability(uuid) from public;
grant execute on function public.list_upcoming_classes_with_availability() to anon, authenticated, service_role;
grant execute on function public.get_class_details_with_availability(uuid) to anon, authenticated, service_role;
