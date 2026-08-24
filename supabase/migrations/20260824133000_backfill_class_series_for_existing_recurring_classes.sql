-- Backfill recurring series links for legacy recurring classes created before class_series existed.
-- Heuristic: classes created in one batch share name/description/capacity and created_at timestamp.

do $$
declare
  group_row record;
  new_series_id uuid;
begin
  for group_row in
    select
      c.name,
      c.description,
      c.capacity,
      c.created_at,
      min(c.starts_at) as starts_from,
      max(c.starts_at)::date as repeat_until
    from public.classes c
    where c.class_series_id is null
    group by c.name, c.description, c.capacity, c.created_at
    having count(*) > 1
  loop
    insert into public.class_series (
      name,
      description,
      capacity,
      starts_from,
      repeat_until,
      is_active
    )
    values (
      group_row.name,
      group_row.description,
      group_row.capacity,
      group_row.starts_from,
      group_row.repeat_until,
      true
    )
    returning id into new_series_id;

    update public.classes c
    set class_series_id = new_series_id
    where c.class_series_id is null
      and c.name is not distinct from group_row.name
      and c.description is not distinct from group_row.description
      and c.capacity = group_row.capacity
      and c.created_at = group_row.created_at;
  end loop;
end;
$$;
