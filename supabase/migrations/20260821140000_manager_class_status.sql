-- S-04 class lifecycle status.
-- Existing classes remain scheduled; cancellation is non-destructive.

create type public.class_status as enum ('scheduled', 'cancelled');

alter table public.classes
  add column status public.class_status not null default 'scheduled';
