create or replace function public.enforce_class_reservation_invariants()
returns trigger
language plpgsql
set search_path = public
as $$
declare
	v_confirmed_count integer;
begin
	select count(*)
	into v_confirmed_count
	from public.reservations r
	where r.class_id = old.id
		and r.status = 'confirmed';

	if new.capacity < v_confirmed_count then
		raise exception using
			message = 'CAPACITY_BELOW_RESERVATIONS',
			errcode = 'P0001',
			detail = 'CAPACITY_BELOW_RESERVATIONS';
	end if;

	if new.starts_at is distinct from old.starts_at and v_confirmed_count > 0 then
		raise exception using
			message = 'STARTS_AT_LOCKED',
			errcode = 'P0001',
			detail = 'STARTS_AT_LOCKED';
	end if;

	return new;
end;
$$;

create trigger classes_reservation_invariants_before_update
	before update of capacity, starts_at on public.classes
	for each row execute function public.enforce_class_reservation_invariants();

create or replace function public.update_manager_class(
	p_class_id uuid,
	p_name text,
	p_description text,
	p_capacity integer,
	p_starts_at timestamptz,
	p_apply_to_series boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_class_series_id uuid;
	v_current_starts_at timestamptz;
	v_target_class_ids uuid[];
	v_confirmed_count integer;
begin
	if auth.uid() is null then
		raise exception using message = 'AUTH_REQUIRED', errcode = '42501', detail = 'AUTH_REQUIRED';
	end if;

	if public.get_my_role() not in ('manager', 'admin') then
		raise exception using message = 'FORBIDDEN', errcode = '42501', detail = 'FORBIDDEN';
	end if;

	if p_capacity < 1 then
		raise exception using message = 'VALIDATION_ERROR', errcode = 'P0001', detail = 'VALIDATION_ERROR';
	end if;

	select c.class_series_id, c.starts_at
	into v_class_series_id, v_current_starts_at
	from public.classes c
	where c.id = p_class_id;

	if not found then
		raise exception using message = 'CLASS_NOT_FOUND', errcode = 'P0001', detail = 'CLASS_NOT_FOUND';
	end if;

	if p_apply_to_series then
		if v_class_series_id is null then
			raise exception using message = 'NOT_RECURRING', errcode = 'P0001', detail = 'NOT_RECURRING';
		end if;

		if v_current_starts_at is distinct from p_starts_at then
			raise exception using
				message = 'SERIES_START_CHANGE_UNSUPPORTED',
				errcode = 'P0001',
				detail = 'SERIES_START_CHANGE_UNSUPPORTED';
		end if;

		select array_agg(c.id order by c.starts_at, c.id)
		into v_target_class_ids
		from public.classes c
		where c.class_series_id = v_class_series_id
			and c.starts_at >= v_current_starts_at;

		if coalesce(array_length(v_target_class_ids, 1), 0) = 0 then
			raise exception using message = 'NOT_RECURRING', errcode = 'P0001', detail = 'NOT_RECURRING';
		end if;

		perform 1
		from public.classes c
		where c.id = any(v_target_class_ids)
		order by c.starts_at, c.id
		for update;

		select count(*)
		into v_confirmed_count
		from public.reservations r
		where r.class_id = any(v_target_class_ids)
			and r.status = 'confirmed'
		group by r.class_id
		order by count(*) desc
		limit 1;

		if coalesce(v_confirmed_count, 0) > p_capacity then
			raise exception using
				message = 'CAPACITY_BELOW_RESERVATIONS',
				errcode = 'P0001',
				detail = 'CAPACITY_BELOW_RESERVATIONS';
		end if;

		update public.classes
		set
			name = p_name,
			description = p_description,
			capacity = p_capacity
		where id = any(v_target_class_ids);
	else
		perform 1
		from public.classes c
		where c.id = p_class_id
		for update;

		select count(*)
		into v_confirmed_count
		from public.reservations r
		where r.class_id = p_class_id
			and r.status = 'confirmed';

		if v_confirmed_count > p_capacity then
			raise exception using
				message = 'CAPACITY_BELOW_RESERVATIONS',
				errcode = 'P0001',
				detail = 'CAPACITY_BELOW_RESERVATIONS';
		end if;

		if v_confirmed_count > 0 and v_current_starts_at is distinct from p_starts_at then
			raise exception using
				message = 'STARTS_AT_LOCKED',
				errcode = 'P0001',
				detail = 'STARTS_AT_LOCKED';
		end if;

		update public.classes
		set
			name = p_name,
			description = p_description,
			capacity = p_capacity,
			starts_at = p_starts_at
		where id = p_class_id;
	end if;

	return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.update_manager_class(uuid, text, text, integer, timestamptz, boolean) from public;
revoke execute on function public.update_manager_class(uuid, text, text, integer, timestamptz, boolean) from anon;
grant execute on function public.update_manager_class(uuid, text, text, integer, timestamptz, boolean) to authenticated, service_role;

grant select on table public.classes to anon, authenticated;
grant insert, update, delete on table public.classes to authenticated;
grant select on table public.reservations to authenticated;
grant select, insert, update on table public.class_series to authenticated;

grant select, insert, update, delete on table public.classes to service_role;
grant select, insert, update, delete on table public.reservations to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.class_series to service_role;