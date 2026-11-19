-- Kaitse andmebaasi tasemel (defense in depth): sama reegel, mis backendi valideerimises.
-- Isegi kui keegi kutsub Supabase'i API-t otse anon-võtmega, ei saa lisada tühja
-- või liiga pikka nime. ÄRA käivita enne, kui oled 00_check_rls.sql tulemust vaadanud
-- ja kontrollinud, et olemasolevad andmed vastavad reeglitele:
--   select * from stores where length(btrim(name)) = 0 or char_length(name) > 100;
--   select * from products where length(btrim(name)) = 0 or char_length(name) > 100;

alter table public.stores
  drop constraint if exists stores_name_not_blank,
  drop constraint if exists stores_name_max_length,
  add constraint stores_name_not_blank check (length(btrim(name)) > 0),
  add constraint stores_name_max_length check (char_length(name) <= 100);

alter table public.products
  drop constraint if exists products_name_not_blank,
  drop constraint if exists products_name_max_length,
  add constraint products_name_not_blank check (length(btrim(name)) > 0),
  add constraint products_name_max_length check (char_length(name) <= 100);

alter table public.products
  alter column is_needed set not null,
  alter column is_needed set default false;

-- Kiirendab poe lehe päringut (filter store_id + sorteerimine).
create index if not exists products_store_needed_name_idx
  on public.products (store_id, is_needed desc, name);
