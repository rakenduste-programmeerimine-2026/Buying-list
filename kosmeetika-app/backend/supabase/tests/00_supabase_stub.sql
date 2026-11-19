-- Testkeskkond: jäljendab Supabase'i (rollid, auth.uid()) ja olemasolevaid tabeleid
-- README andmemudeli järgi. Kasutatakse ainult lokaalses Postgres'is testimiseks,
-- MITTE päris Supabase'i projektis.

-- Rollid on klastri-ülesed, seega loo ainult kui puuduvad.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Tabelid nagu README andmemudelis (Supabase'i poolel juba loodud).
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  is_needed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Supabase annab vaikimisi need õigused API rollidele.
grant usage on schema public to anon, authenticated;
grant all on public.stores, public.products to anon, authenticated;

-- Varasem lubav reegel (nagu „allow all“), mille 02_rls_auth.sql peab eemaldama.
alter table public.stores enable row level security;
create policy "old_allow_all" on public.stores for all to anon, authenticated using (true) with check (true);
