-- S-03 schedule view adjustment.
-- Include started classes in a 7-day schedule window.
-- Schedule bucketing contract: UTC day window and UTC hour slots.

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
	where c.starts_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
		and c.starts_at < (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + interval '7 day'
		and extract(hour from c.starts_at at time zone 'UTC') between 8 and 21
	group by c.id, c.name, c.description, c.capacity, c.starts_at
	order by c.starts_at asc;
$$;

grant execute on function public.list_upcoming_classes_with_availability() to anon, authenticated, service_role;
