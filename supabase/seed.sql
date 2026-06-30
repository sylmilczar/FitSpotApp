-- Minimal booking-domain seed fixture for local verification

insert into public.classes (id, name, description, capacity, starts_at)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Morning Flow Yoga',
    'Low-impact mobility and breath work session.',
    12,
    now() + interval '1 day'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Strength Basics',
    'Introductory full-body strength class.',
    8,
    now() + interval '2 days'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Sunset Stretch',
    'Recovery-focused evening stretching class.',
    10,
    now() - interval '1 hour'
  )
on conflict (id) do nothing;
