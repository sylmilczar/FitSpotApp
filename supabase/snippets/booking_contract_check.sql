-- Contract check for create_reservation guardrails
-- Cases covered: success, ALREADY_RESERVED, CLASS_FULL, CLASS_STARTED

begin;

create temp table __check_results(code text not null);

-- Create deterministic users for checks.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'booking-check-user-a@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now()
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'booking-check-user-b@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now()
  )
on conflict (id) do nothing;

-- SUCCESS case
select public.create_reservation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');

-- ALREADY_RESERVED case
do $$
begin
  perform public.create_reservation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
exception when others then
  insert into __check_results(code) values (coalesce(SQLERRM, 'UNKNOWN'));
end $$;

-- CLASS_FULL case (class 222... has capacity 8)
do $$
declare
  i integer;
  v_user_id uuid;
begin
  for i in 1..9 loop
    v_user_id := ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at
    )
    values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      format('booking-check-fill-%s@example.com', i),
      crypt('password123', gen_salt('bf')),
      now(),
      now(),
      now()
    )
    on conflict (id) do nothing;

    if i <= 8 then
      perform public.create_reservation(v_user_id, '22222222-2222-2222-2222-222222222222');
    else
      begin
        perform public.create_reservation(v_user_id, '22222222-2222-2222-2222-222222222222');
      exception when others then
        insert into __check_results(code) values (coalesce(SQLERRM, 'UNKNOWN'));
      end;
    end if;
  end loop;
end $$;

-- CLASS_STARTED case (class 333... started in seed)
do $$
begin
  perform public.create_reservation('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333');
exception when others then
  insert into __check_results(code) values (coalesce(SQLERRM, 'UNKNOWN'));
end $$;

-- Assert expected error codes captured.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from __check_results where code = 'ALREADY_RESERVED';
  if v_count <> 1 then
    raise exception 'Expected ALREADY_RESERVED once, got %', v_count;
  end if;

  select count(*) into v_count from __check_results where code = 'CLASS_FULL';
  if v_count <> 1 then
    raise exception 'Expected CLASS_FULL once, got %', v_count;
  end if;

  select count(*) into v_count from __check_results where code = 'CLASS_STARTED';
  if v_count <> 1 then
    raise exception 'Expected CLASS_STARTED once, got %', v_count;
  end if;
end $$;

rollback;
