create or replace function public.create_reservation(p_user_id uuid, p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_capacity integer;
	v_starts_at timestamptz;
	v_status public.class_status;
	v_confirmed_count integer;
begin
	if auth.uid() is null then
		raise exception using message = 'AUTH_REQUIRED', errcode = '42501', detail = 'AUTH_REQUIRED';
	end if;

	if p_user_id <> auth.uid() then
		raise exception using message = 'FORBIDDEN', errcode = '42501', detail = 'FORBIDDEN';
	end if;

	select c.capacity, c.starts_at, c.status
	into v_capacity, v_starts_at, v_status
	from public.classes c
	where c.id = p_class_id
	for update;

	if not found then
		raise exception 'Class not found';
	end if;

	if v_status = 'cancelled' then
		raise exception using message = 'CLASS_CANCELLED', errcode = 'P0001', detail = 'CLASS_CANCELLED';
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

revoke execute on function public.create_reservation(uuid, uuid) from public;
revoke execute on function public.create_reservation(uuid, uuid) from anon;
grant execute on function public.create_reservation(uuid, uuid) to authenticated, service_role;