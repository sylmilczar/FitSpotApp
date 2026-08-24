-- Normalize upcoming reservation window to absolute future time.
-- Avoid UTC day/hour slicing so UI can consistently present local user time.

drop function public.get_user_upcoming_reservations(uuid);

create function public.get_user_upcoming_reservations(p_user_id uuid)
returns table (
	reservation_id uuid,
	class_id uuid,
	class_name text,
	class_description text,
	starts_at timestamptz,
	class_status public.class_status,
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
			c.status as class_status,
			c.capacity,
			count(r2.id) filter (where r2.status = 'confirmed') as confirmed_reservations_count,
			greatest(c.capacity::bigint - count(r2.id) filter (where r2.status = 'confirmed'), 0) as available_spots,
			r.status
		from public.reservations r
		join public.classes c on c.id = r.class_id
		left join public.reservations r2 on r2.class_id = c.id
		where r.user_id = p_user_id
			and r.status = 'confirmed'
			and c.starts_at >= now()
			and c.starts_at < now() + interval '7 day'
		group by r.id, r.class_id, c.id, c.name, c.description, c.starts_at, c.status, c.capacity, r.status
		order by c.starts_at asc;
end;
$$;

revoke execute on function public.get_user_upcoming_reservations(uuid) from public;
revoke execute on function public.get_user_upcoming_reservations(uuid) from anon;
grant execute on function public.get_user_upcoming_reservations(uuid) to authenticated, service_role;
