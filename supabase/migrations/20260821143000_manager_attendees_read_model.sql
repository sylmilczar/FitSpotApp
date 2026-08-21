-- S-04 manager/admin attendee read model.
-- Email is projected through public.profiles, never directly from auth.users.

create or replace function public.get_class_attendees(p_class_id uuid)
returns table (
	reservation_id uuid,
	user_id uuid,
	user_email text,
	status public.reservation_status,
	created_at timestamptz
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

	if public.get_my_role() not in ('manager', 'admin') then
		raise exception using message = 'FORBIDDEN', errcode = '42501';
	end if;

	return query
		select
			r.id as reservation_id,
			r.user_id,
			p.email as user_email,
			r.status,
			r.created_at
		from public.reservations r
		join public.profiles p on p.user_id = r.user_id
		where r.class_id = p_class_id
		order by r.created_at asc;
end;
$$;

revoke execute on function public.get_class_attendees(uuid) from public;
revoke execute on function public.get_class_attendees(uuid) from anon;
grant execute on function public.get_class_attendees(uuid) to authenticated, service_role;
