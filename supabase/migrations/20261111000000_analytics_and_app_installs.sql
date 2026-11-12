-- Migration: Add views_count to public.books and create public.app_installs table with RPC helpers

begin;

-- 1. Add views_count column to public.books if it does not exist
alter table public.books
add column if not exists views_count integer not null default 0;

-- 2. Grant update on views_count to anon and authenticated users
grant update (views_count) on public.books to anon, authenticated;

-- 3. Create atomic helper function to increment book views with parameter book_id (and target_book_id alias)
create or replace function public.increment_book_views(book_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.books
  set views_count = coalesce(views_count, 0) + 1
  where id = book_id
  returning views_count into new_count;
  
  return coalesce(new_count, 0);
end;
$$;

grant execute on function public.increment_book_views(uuid) to anon, authenticated;

-- 4. Create public.app_installs table
create table if not exists public.app_installs (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  platform text,
  created_at timestamptz not null default now()
);

-- Ensure platform column exists if table was already created
alter table public.app_installs
add column if not exists platform text;

-- Enable Row Level Security (RLS)
alter table public.app_installs enable row level security;

-- Grant table privileges
grant select, insert, update on public.app_installs to anon, authenticated;

-- Allow anon and authenticated clients to insert new installation records
drop policy if exists "anyone can record app install" on public.app_installs;
create policy "anyone can record app install"
on public.app_installs for insert
to anon, authenticated
with check (true);

-- Allow anon and authenticated clients to update on upsert conflict
drop policy if exists "anyone can update app install" on public.app_installs;
create policy "anyone can update app install"
on public.app_installs for update
to anon, authenticated
using (true)
with check (true);

-- Allow anon and authenticated clients to read installation count for analytics
drop policy if exists "anyone can read install count" on public.app_installs;
create policy "anyone can read install count"
on public.app_installs for select
to anon, authenticated
using (true);

-- 5. Helper function to record unique app install idempotently
create or replace function public.record_app_install(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_created boolean := false;
begin
  if p_device_id is null or trim(p_device_id) = '' then
    return jsonb_build_object('success', false, 'error', 'device_id is empty');
  end if;

  insert into public.app_installs (device_id)
  values (trim(p_device_id))
  on conflict (device_id) do nothing
  returning id into v_id;

  if v_id is not null then
    v_created := true;
  end if;

  return jsonb_build_object('success', true, 'created', v_created);
end;
$$;

grant execute on function public.record_app_install(text) to anon, authenticated;

commit;
