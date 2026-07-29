-- S-02 user upcoming reservations read model.
-- Returns only current user's confirmed reservations in the same
-- UTC 7-day schedule window used by timetable read models.

create or replace function public.get_user_upcoming_reservations(p_user_id uuid)
returns table (
	reservation_id uuid,
	class_id uuid,
	class_name text,
	class_description text,
	starts_at timestamptz,
	capacity integer,
	confirmed_reservations_count bigint,
	available_spots bigint,
	status public.reservation_status
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
	if auth.uid() is null then
		raise exception using message = 'AUTH_REQUIRED', errcode = '42501';
	end if;

	if p_user_id <> auth.uid() then
		raise exception using message = 'FORBIDDEN', errcode = '42501';
	end if;

	return query
		select
			r.id as reservation_id,
			r.class_id,
			c.name as class_name,
			c.description as class_description,
			c.starts_at,
			c.capacity,
			count(r2.id) as confirmed_reservations_count,
			greatest(c.capacity::bigint - count(r2.id), 0) as available_spots,
			r.status
		from public.reservations r
		join public.classes c
			on c.id = r.class_id
		left join public.reservations r2
			on r2.class_id = c.id
			and r2.status = 'confirmed'
		where r.user_id = p_user_id
			and r.status = 'confirmed'
			and c.starts_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
			and c.starts_at < (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + interval '7 day'
			and extract(hour from c.starts_at at time zone 'UTC') between 8 and 21
		group by r.id, r.class_id, c.id, c.name, c.description, c.starts_at, c.capacity, r.status
		order by c.starts_at asc;
end;
$$;

revoke execute on function public.get_user_upcoming_reservations(uuid) from public;
revoke execute on function public.get_user_upcoming_reservations(uuid) from anon;
grant execute on function public.get_user_upcoming_reservations(uuid) to authenticated, service_role;
