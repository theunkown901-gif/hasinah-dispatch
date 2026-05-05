create extension if not exists pgcrypto;

create table if not exists public.hasinah_users (
  id text primary key,
  role text not null check (role in ('admin', 'driver')),
  name text not null,
  username text not null unique,
  password text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.hasinah_orders (
  id text primary key,
  kind text not null check (kind in ('customer', 'custom')),
  flow_type text not null default 'order' check (flow_type in ('order', 'return', 'replacement', 'custom')),
  number text not null,
  type text not null,
  customer text not null,
  phone text not null,
  area text not null,
  driver_id text references public.hasinah_users(id) on delete set null,
  custom_amount numeric(10, 2) not null default 0,
  timer_hours integer not null default 24,
  request_date timestamptz,
  status text not null default 'new' check (status in ('new', 'pending_acceptance', 'accepted', 'completed', 'late', 'delayed', 'cancelled')),
  accepted_at timestamptz,
  deadline_at timestamptz,
  completed_at timestamptz,
  cut_removed boolean not null default false,
  returned_order_number text,
  replacement_order_number text,
  source_order_id text references public.hasinah_orders(id) on delete set null,
  delay_requests jsonb not null default '[]'::jsonb,
  appeals jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hasinah_order_requests (
  id text primary key,
  order_id text not null references public.hasinah_orders(id) on delete cascade,
  request_type text not null check (request_type in ('delay', 'appeal')),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

insert into public.hasinah_users (id, role, name, username, password)
values ('usr-yahya', 'admin', 'يحيى', 'yahya', '123123')
on conflict (username) do nothing;
