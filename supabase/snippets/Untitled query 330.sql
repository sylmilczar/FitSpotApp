select
  u.id,
  u.email,
  p.role
from auth.users u
join public.profiles p on p.user_id = u.id
order by u.created_at;

select
  id,
  name,
  status,
  starts_at
from public.classes
order by starts_at;