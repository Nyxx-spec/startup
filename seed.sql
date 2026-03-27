-- ============================================================
--  FreshSave — Complete Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → Run
--
--  This version supports a plain browser JS frontend with NO
--  Node.js backend. The anon key is used directly from the
--  browser. RLS policies are permissive for demo purposes.
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ── USERS ────────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  email         text unique not null,
  password_hash text,                  -- nullable: passwords managed by Supabase Auth
  role          text not null check (role in ('admin','buyer','seller')) default 'buyer',
  status        text not null check (status in ('Active','Suspended','Pending','Verified')) default 'Active',
  biz_type      text,
  location      text,
  permit        text,
  joined_at     timestamptz default now(),
  last_login    timestamptz default now()
);

-- ── LISTINGS ─────────────────────────────────────────────────
create table if not exists listings (
  id           uuid primary key default uuid_generate_v4(),
  item         text not null,
  business     text not null,
  type         text,
  orig_price   numeric(10,2) not null,
  disc_price   numeric(10,2) not null,
  pct          int generated always as (round((1 - disc_price / orig_price) * 100)) stored,
  location     text,
  pickup_time  text,
  posted_by    text,
  posted_email text,
  status       text not null check (status in ('Pending','Approved','Rejected')) default 'Pending',
  featured     boolean default false,
  created_at   timestamptz default now()
);

-- ── RESERVATIONS (ORDERS) ────────────────────────────────────
create table if not exists reservations (
  id             text primary key,            -- e.g. ORD-1717000000000
  buyer_name     text not null,
  buyer_email    text not null,
  item           text not null,
  business       text not null,
  price          text not null,
  status         text not null check (status in ('Reserved','Picked Up','Disputed','Cancelled','Refunded','Resolved')) default 'Reserved',
  pickup_status  text not null default 'Awaiting Pickup',
  created_at     timestamptz default now()
);

-- ── REPORTS ──────────────────────────────────────────────────
create table if not exists reports (
  id             text primary key,            -- e.g. RPT-1717000000000
  reporter       text not null,
  reporter_email text not null,
  against        text not null,
  issue_type     text not null,
  details        text,
  status         text not null default 'Open',
  created_at     timestamptz default now()
);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default uuid_generate_v4(),
  msg        text not null,
  target     text not null,
  type       text not null default 'deal',
  created_at timestamptz default now()
);

-- ── ADMIN LOG ─────────────────────────────────────────────────
create table if not exists admin_log (
  id         uuid primary key default uuid_generate_v4(),
  msg        text not null,
  type       text not null default 'blue',   -- green | red | amber | blue
  created_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- Enable RLS on all tables
alter table users         enable row level security;
alter table listings      enable row level security;
alter table reservations  enable row level security;
alter table reports       enable row level security;
alter table notifications enable row level security;
alter table admin_log     enable row level security;

-- ── DROP existing policies (safe re-run) ──────────────────────
drop policy if exists "anon_users_all"         on users;
drop policy if exists "anon_listings_all"      on listings;
drop policy if exists "anon_reservations_all"  on reservations;
drop policy if exists "anon_reports_all"       on reports;
drop policy if exists "anon_notifications_all" on notifications;
drop policy if exists "anon_admin_log_all"     on admin_log;
drop policy if exists "public_read_approved_listings" on listings;

-- ── Permissive policies for anon role (no-backend / browser app) ──
-- NOTE: In production you would scope these per authenticated user.
-- For a demo or school project, open anon access is acceptable.

create policy "anon_users_all"
  on users for all
  to anon
  using (true)
  with check (true);

create policy "anon_listings_all"
  on listings for all
  to anon
  using (true)
  with check (true);

create policy "anon_reservations_all"
  on reservations for all
  to anon
  using (true)
  with check (true);

create policy "anon_reports_all"
  on reports for all
  to anon
  using (true)
  with check (true);

create policy "anon_notifications_all"
  on notifications for all
  to anon
  using (true)
  with check (true);

create policy "anon_admin_log_all"
  on admin_log for all
  to anon
  using (true)
  with check (true);

-- ── INDEXES ───────────────────────────────────────────────────
create index if not exists idx_listings_status    on listings(status);
create index if not exists idx_listings_featured  on listings(featured);
create index if not exists idx_reservations_email on reservations(buyer_email);
create index if not exists idx_reservations_status on reservations(status);
create index if not exists idx_reports_status     on reports(status);
create index if not exists idx_users_role         on users(role);
create index if not exists idx_users_status       on users(status);
create index if not exists idx_users_email        on users(email);

-- ── SEED: Default Admin Account ───────────────────────────────
-- Password: admin123   (bcrypt hash, cost 12)
-- Change the email to your own preferred admin email.
insert into users (name, email, password_hash, role, status)
values (
  'Admin',
  'admin@freshsave.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgRhHJF7lNJLQ.7oBJuXAe',
  'admin',
  'Active'
)
on conflict (email) do nothing;
