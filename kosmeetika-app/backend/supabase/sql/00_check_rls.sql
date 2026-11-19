-- Kontroll: kas RLS on tabelitel sees ja millised reeglid kehtivad?
-- Käivita Supabase'i SQL Editoris. See päring EI muuda midagi.

select schemaname, tablename, rowsecurity as rls_enabled, forcerowsecurity as rls_forced
from pg_tables
where schemaname = 'public' and tablename in ('stores', 'products');

select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public' and tablename in ('stores', 'products')
order by tablename, cmd;

-- Millised õigused on anon / authenticated rollidel?
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('stores', 'products')
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- Kas foreign key on ON DELETE CASCADE?
select conname, confdeltype -- 'c' = cascade
from pg_constraint
where conrelid = 'public.products'::regclass and contype = 'f';
