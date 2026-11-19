-- RLS: iga kasutaja näeb ja muudab ainult oma poode ja tooteid.
--
-- Eeldab Supabase Auth'i (e-post + parool, vt lib/actions/auth.ts).
-- Backendi kood ei muutu: user_id täidetakse andmebaasis automaatselt
-- (default auth.uid()), ja serveri klient saadab sessiooni küpsistest.
--
-- Faili võib korduvalt käivitada (drop policy if exists).
--
-- NB: olemasolevad read jäävad ilma omanikuta (user_id = null) ja muutuvad
-- nähtamatuks. Määra neile omanik enne `set not null` rida:
--   update public.stores set user_id = '<sinu-auth-user-id>' where user_id is null;

alter table public.stores
  add column if not exists user_id uuid references auth.users (id) on delete cascade default auth.uid();

-- alter table public.stores alter column user_id set not null;

create index if not exists stores_user_id_idx on public.stores (user_id);

alter table public.stores enable row level security;
alter table public.products enable row level security;

-- Anonüümne roll ei pääse tabelitele üldse ligi.
revoke all on public.stores from anon;
revoke all on public.products from anon;

-- stores: ainult omanik
drop policy if exists "stores_select_own" on public.stores;
create policy "stores_select_own" on public.stores
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "stores_insert_own" on public.stores;
create policy "stores_insert_own" on public.stores
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "stores_update_own" on public.stores;
create policy "stores_update_own" on public.stores
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "stores_delete_own" on public.stores;
create policy "stores_delete_own" on public.stores
  for delete to authenticated using ((select auth.uid()) = user_id);

-- products: ligipääs poe omaniku kaudu
drop policy if exists "products_select_own" on public.products;
create policy "products_select_own" on public.products
  for select to authenticated using (
    exists (select 1 from public.stores s where s.id = store_id and s.user_id = (select auth.uid()))
  );
drop policy if exists "products_insert_own" on public.products;
create policy "products_insert_own" on public.products
  for insert to authenticated with check (
    exists (select 1 from public.stores s where s.id = store_id and s.user_id = (select auth.uid()))
  );
-- with check takistab toote "tõstmist" kellegi teise poodi.
drop policy if exists "products_update_own" on public.products;
create policy "products_update_own" on public.products
  for update to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.user_id = (select auth.uid())));
drop policy if exists "products_delete_own" on public.products;
create policy "products_delete_own" on public.products
  for delete to authenticated using (
    exists (select 1 from public.stores s where s.id = store_id and s.user_id = (select auth.uid()))
  );
