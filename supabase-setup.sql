-- Replace ADMIN_EMAIL_REPLACE_ME with the admin's exact email, lowercase.
create extension if not exists pgcrypto;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 1000),
  type text not null default 'task' check (type in ('task','offer')),
  reward text check (reward is null or char_length(reward) <= 80),
  destination_url text,
  button_label text not null default 'View details' check (char_length(button_label) <= 40),
  status text not null default 'published' check (status in ('published','draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.offers enable row level security;

drop policy if exists "Anyone can read published offers" on public.offers;
create policy "Anyone can read published offers"
on public.offers for select to anon, authenticated
using (status = 'published' or lower(coalesce(auth.jwt()->>'email','')) = lower('ADMIN_EMAIL_REPLACE_ME'));

drop policy if exists "Admin can insert offers" on public.offers;
create policy "Admin can insert offers"
on public.offers for insert to authenticated
with check (lower(coalesce(auth.jwt()->>'email','')) = lower('ADMIN_EMAIL_REPLACE_ME'));

drop policy if exists "Admin can update offers" on public.offers;
create policy "Admin can update offers"
on public.offers for update to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = lower('ADMIN_EMAIL_REPLACE_ME'))
with check (lower(coalesce(auth.jwt()->>'email','')) = lower('ADMIN_EMAIL_REPLACE_ME'));

drop policy if exists "Admin can delete offers" on public.offers;
create policy "Admin can delete offers"
on public.offers for delete to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = lower('ADMIN_EMAIL_REPLACE_ME'));

-- Enable realtime notifications for this table.
do $$
begin
  alter publication supabase_realtime add table public.offers;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

grant usage on schema public to anon, authenticated;
grant select on public.offers to anon, authenticated;
grant insert, update, delete on public.offers to authenticated;
