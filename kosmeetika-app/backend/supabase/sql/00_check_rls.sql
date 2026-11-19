-- Kontroll: kas RLS on tabelitel sees ja millised reeglid kehtivad?
-- Käivita Supabase'i SQL Editoris. See päring EI muuda midagi.
--
-- Kõik kontrollid on ühes päringus, sest SQL Editor näitab ainult viimase
-- lause tulemust. Iga rida: jaotis | tabel | nimi | väärtus.
-- NB: pg_tables vaates pole veergu "forcerowsecurity" – see on pg_class.relforcerowsecurity.

with
rls as (
  select '1 RLS'::text as section, c.relname::text as table_name,
         'rls_enabled / rls_forced'::text as name,
         c.relrowsecurity::text || ' / ' || c.relforcerowsecurity::text as value
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('stores', 'products') and c.relkind = 'r'
),
policies as (
  select '2 policy', tablename::text, policyname::text,
         cmd || ' to ' || array_to_string(roles, ',')
         || coalesce(' | using: ' || qual, '')
         || coalesce(' | with check: ' || with_check, '')
  from pg_policies
  where schemaname = 'public' and tablename in ('stores', 'products')
),
-- Millised õigused on anon / authenticated rollidel?
grants as (
  select '3 grants', table_name::text, grantee::text,
         string_agg(privilege_type, ', ' order by privilege_type)
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name in ('stores', 'products')
    and grantee in ('anon', 'authenticated')
  group by table_name, grantee
),
-- Kas foreign key on ON DELETE CASCADE? ('c' = cascade)
fks as (
  select '4 foreign key', 'products', conname::text,
         'on delete: ' || confdeltype::text || ' | ' || pg_get_constraintdef(oid)
  from pg_constraint
  where conrelid = 'public.products'::regclass and contype = 'f'
)
select * from rls
union all select * from policies
union all select * from grants
union all select * from fks
order by 1, 2, 3;
