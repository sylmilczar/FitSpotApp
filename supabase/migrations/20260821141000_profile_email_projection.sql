-- S-04 controlled profile email projection for manager attendee views.

alter table public.profiles
  add column email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.user_id;

alter table public.profiles
  alter column email set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.profiles (user_id, email, role)
	values (new.id, new.email, 'client')
	on conflict (user_id) do update
	set email = excluded.email;
	return new;
end;
$$;
