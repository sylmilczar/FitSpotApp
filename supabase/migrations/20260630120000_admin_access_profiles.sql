-- Admin access foundation — role schema
-- Creates app_role enum, profiles table, signup trigger, and get_my_role() helper.

create type public.app_role as enum ('client', 'manager', 'admin');

create table public.profiles (
	user_id uuid primary key references auth.users(id) on delete cascade,
	role public.app_role not null default 'client',
	created_at timestamptz not null default now()
);

-- Auto-create a client profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.profiles (user_id, role)
	values (new.id, 'client')
	on conflict (user_id) do nothing;
	return new;
end;
$$;

create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();

-- Helper for RLS policies: returns the current user's role as text.
-- SECURITY DEFINER avoids recursive RLS checks on the profiles table itself.
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
	select role::text
	from public.profiles
	where user_id = auth.uid()
$$;

grant select on public.profiles to authenticated;
grant execute on function public.get_my_role() to authenticated, anon;
