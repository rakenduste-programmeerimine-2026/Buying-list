-- RLS testid. Käivita: supabase/tests/run.sh
-- Iga kontroll viskab vea, kui reegel ei pea.

\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create or replace function pg_temp.login(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
end $$;

insert into auth.users values
  ('aaaaaaaa-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002');

-- ── Kasutaja A loob poe ja toote ─────────────────────────────────────────────
set role authenticated;
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');

insert into public.stores (id, name) values ('11111111-0000-4000-8000-00000000000a', 'A pood');
insert into public.products (id, store_id, name) values
  ('22222222-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'A toode');

select pg_temp.assert(
  (select user_id from public.stores where id = '11111111-0000-4000-8000-00000000000a') = 'aaaaaaaa-0000-4000-8000-000000000001',
  'user_id täidetakse automaatselt (default auth.uid())');
select pg_temp.assert((select count(*) from public.stores) = 1, 'A näeb oma poodi');
select pg_temp.assert((select count(*) from public.products) = 1, 'A näeb oma toodet');

-- ── Kasutaja B ei näe ega muuda A andmeid ───────────────────────────────────
select pg_temp.login('bbbbbbbb-0000-4000-8000-000000000002');
select pg_temp.assert((select count(*) from public.stores) = 0, 'B ei näe A poodi');
select pg_temp.assert((select count(*) from public.products) = 0, 'B ei näe A toodet');

with u as (update public.stores set name = 'häkitud' where id = '11111111-0000-4000-8000-00000000000a' returning 1)
select pg_temp.assert((select count(*) from u) = 0, 'B ei saa A poodi ümber nimetada');
with u as (update public.products set is_needed = true where id = '22222222-0000-4000-8000-00000000000a' returning 1)
select pg_temp.assert((select count(*) from u) = 0, 'B ei saa A toote märget muuta');
with d as (delete from public.products returning 1)
select pg_temp.assert((select count(*) from d) = 0, 'B ei saa A tooteid kustutada');
with d as (delete from public.stores returning 1)
select pg_temp.assert((select count(*) from d) = 0, 'B ei saa A poode kustutada');

-- B ei saa lisada toodet A poodi
do $$ begin
  insert into public.products (store_id, name) values ('11111111-0000-4000-8000-00000000000a', 'sissemurdja');
  raise exception 'FAIL: B sai lisada toote A poodi';
exception when insufficient_privilege then raise notice 'ok - B ei saa lisada toodet A poodi';
end $$;

-- B ei saa luua poodi A nimele
do $$ begin
  insert into public.stores (name, user_id) values ('võlts', 'aaaaaaaa-0000-4000-8000-000000000001');
  raise exception 'FAIL: B sai luua poe A nimele';
exception when insufficient_privilege then raise notice 'ok - B ei saa luua poodi teise kasutaja nimele';
end $$;

-- B loob oma poe ja proovib oma poe A-le "kinkida" või toote A poodi tõsta
insert into public.stores (id, name) values ('11111111-0000-4000-8000-00000000000b', 'B pood');
insert into public.products (id, store_id, name) values
  ('22222222-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'B toode');
do $$ begin
  update public.products set store_id = '11111111-0000-4000-8000-00000000000a' where id = '22222222-0000-4000-8000-00000000000b';
  raise exception 'FAIL: B sai toote A poodi tõsta';
exception when insufficient_privilege then raise notice 'ok - B ei saa toodet A poodi tõsta';
end $$;
do $$ begin
  update public.stores set user_id = 'aaaaaaaa-0000-4000-8000-000000000001' where id = '11111111-0000-4000-8000-00000000000b';
  raise exception 'FAIL: B sai poe omaniku vahetada';
exception when insufficient_privilege then raise notice 'ok - B ei saa poe omanikku vahetada';
end $$;

-- ── Valideerimine andmebaasis ───────────────────────────────────────────────
do $$ begin
  insert into public.stores (name) values ('   ');
  raise exception 'FAIL: tühi nimi läks läbi';
exception when check_violation then raise notice 'ok - tühja poe nime ei saa lisada';
end $$;
do $$ begin
  insert into public.products (store_id, name) values ('11111111-0000-4000-8000-00000000000b', repeat('x', 101));
  raise exception 'FAIL: liiga pikk nimi läks läbi';
exception when check_violation then raise notice 'ok - liiga pikka toote nime ei saa lisada';
end $$;

-- ── Anonüümne roll (ilma sisselogimiseta) ei pääse ligi ─────────────────────
reset role;
set role anon;
select pg_temp.login(null);
do $$ begin
  perform count(*) from public.stores;
  raise exception 'FAIL: anon sai stores tabelit lugeda';
exception when insufficient_privilege then raise notice 'ok - anon ei saa poode lugeda';
end $$;
do $$ begin
  insert into public.stores (name) values ('anon');
  raise exception 'FAIL: anon sai poe lisada';
exception when insufficient_privilege then raise notice 'ok - anon ei saa poodi lisada';
end $$;

-- ── Kaskaadkustutamine omaniku poolt ────────────────────────────────────────
reset role;
set role authenticated;
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000000001');
delete from public.stores where id = '11111111-0000-4000-8000-00000000000a';
reset role;
select pg_temp.assert(
  (select count(*) from public.products where store_id = '11111111-0000-4000-8000-00000000000a') = 0,
  'poe kustutamine kustutab ka tooted (ON DELETE CASCADE)');
select pg_temp.assert(
  (select count(*) from public.stores where id = '11111111-0000-4000-8000-00000000000b') = 1,
  'B pood jäi alles');

\o
\echo 'Kõik RLS testid läbitud.'
