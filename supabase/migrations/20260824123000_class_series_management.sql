-- Add recurring series model and link classes to a series.

create table public.class_series (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  capacity integer not null check (capacity > 0),
  starts_from timestamptz not null,
  repeat_until date not null,
  is_active boolean not null default true,
  disabled_from timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.classes
  add column class_series_id uuid references public.class_series(id) on delete set null;

create index idx_classes_series_id on public.classes(class_series_id);
create index idx_classes_series_schedule on public.classes(class_series_id, starts_at);

alter table public.class_series enable row level security;

create policy "Managers and admins can view class series"
  on public.class_series
  for select
  using (public.get_my_role() in ('manager', 'admin'));

create policy "Managers and admins can insert class series"
  on public.class_series
  for insert
  with check (public.get_my_role() in ('manager', 'admin'));

create policy "Managers and admins can update class series"
  on public.class_series
  for update
  using (public.get_my_role() in ('manager', 'admin'))
  with check (public.get_my_role() in ('manager', 'admin'));
