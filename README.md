# Buying-list 🛍️
 
Lihtne veebirakendus kosmeetikavahendite ostunimekirja pidamiseks.
 
Rakendus on mõeldud kosmeetikule (FIE), kes ostab töövahendeid mitmest poest ja tootjalt. Rakenduses saab pidada ülevaadet, **millisest poest milliseid tooteid ostetakse** ja **mida on parasjagu juurde vaja**.
 
 
## Funktsionaalsus
 
- **Poed / tootjad**: kasutaja saab lisada poe või tootja nime.
- **Tooted**: iga poe alla saab lisada tooteid, mida sealt ostetakse.
- **„Vaja juurde“ märge**: iga toote kõrval on lahter (checkbox), millega saab märkida, et toodet on vaja juurde osta.
- **Sorteerimine**: „vaja juurde“ märgitud tooted kuvatakse nimekirja **alguses**, ülejäänud nende järel.
### Kasutajavoog
 
1. Avalehel on poodide loetelu ja võimalus uus pood lisada.
2. Poe nimel klikkides avaneb selle poe toodete nimekiri.
3. Poe lehel saab lisada uusi tooteid ja märkida, milliseid on vaja juurde.
## Tehnoloogiad
 
| Osa | Tehnoloogia |
| --- | --- |
| Raamistik | [Next.js](https://nextjs.org/) (App Router) |
| Keel | [TypeScript](https://www.typescriptlang.org/) |
| Andmebaas | [Supabase](https://supabase.com/) (PostgreSQL) |
| Supabase klient | `@supabase/supabase-js`, `@supabase/ssr` |
 
 
## Andmemudel
 
### `stores` – poed / tootjad
 
| Väli | Tüüp | Kirjeldus |
| --- | --- | --- |
| `id` | `uuid` (PK) | Unikaalne ID |
| `name` | `text` | Poe või tootja nimi |
| `created_at` | `timestamptz` | Loomise aeg |
 
### `products` – tooted
 
| Väli | Tüüp | Kirjeldus |
| --- | --- | --- |
| `id` | `uuid` (PK) | Unikaalne ID |
| `store_id` | `uuid` (FK → `stores.id`) | Pood, kust toodet ostetakse |
| `name` | `text` | Toote nimi |
| `is_needed` | `boolean` (vaikimisi `false`) | Kas toodet on vaja juurde |
| `created_at` | `timestamptz` | Loomise aeg |
 
Seos: **üks pood → mitu toodet**. Poe kustutamisel kustuvad ka selle tooted (`ON DELETE CASCADE`).
 
 
## Projekti käivitamine
 
### 1. Klooni repo
 
```bash
git clone <repo-url>
cd buying-list
```
 
### 2. Paigalda sõltuvused
 
```bash
npm install
```
 
### 3. Keskkonnamuutujad
 
Loo projekti juurkausta fail `.env.local`:
 
```env
NEXT_PUBLIC_SUPABASE_URL=https://<projekti-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```
 
Väärtused leiad Supabase'i projektist: **Project Settings → API**.
 
> 🔒 `.env.local` faili **ei tohi** GitHubi lisada (see peab olema `.gitignore`'is).
 
### 4. Käivita arendusserver
 
```bash
npm run dev
```
 
Rakendus avaneb aadressil [http://localhost:3000](http://localhost:3000).
 
 
## Kaustade struktuur
 
Soovituslik struktuur:
 
```
src/
├── app/
│   ├── page.tsx                 # Avaleht: poodide loetelu + uue poe lisamine
│   └── stores/
│       └── [id]/
│           └── page.tsx         # Poe leht: toodete nimekiri
├── components/                  # UI komponendid (frontend)
│   ├── StoreList.tsx
│   ├── AddStoreForm.tsx
│   ├── ProductList.tsx
│   ├── ProductItem.tsx
│   └── AddProductForm.tsx
├── lib/
│   ├── supabase/                # Supabase'i kliendid (backend)
│   │   ├── client.ts
│   │   └── server.ts
│   └── actions/                 # Server Actions / andmeloogika (backend)
│       ├── stores.ts
│       └── products.ts
└── types/
    └── database.ts              # Supabase'ist genereeritud tüübid
```
 
 
## Tööjaotus
 
Projekti teeb **kolm arendajat**: Supabase'i osa on valmis, edasi jagunevad ülesanded backendi ja frontendi vahel.
 
### Supabase (tehtud)
 
- [x] Supabase'i projekt loodud
- [x] Tabelid `stores` ja `products` loodud
- [x] Seosed tabelite vahel
### Backend developer
 
Backendi ülesanne on ühendada Next.js rakendus Supabase'iga ja pakkuda frontendile valmis funktsioonid andmetega töötamiseks.
 
#### Ülesanded
 
- [ ] **Supabase'i kliendi seadistamine**
  - `lib/supabase/client.ts` – brauseri klient
  - `lib/supabase/server.ts` – serveri klient (`@supabase/ssr`)
- [ ] **TypeScripti tüübid**
  - Genereeri tüübid Supabase'i skeemist:
```bash
npx supabase gen types typescript --project-id <projekti-id> > src/types/database.ts
```
- [ ] **Poodide funktsioonid** (`lib/actions/stores.ts`)
  - `getStores()` – kõigi poodide loetelu (tähestiku järjekorras)
  - `getStoreById(id)` – ühe poe andmed
  - `createStore(name)` – uue poe lisamine
  - *(valikuline)* `updateStore(id, name)`, `deleteStore(id)`
- [ ] **Toodete funktsioonid** (`lib/actions/products.ts`)
  - `getProductsByStore(storeId)` – poe tooted, sorteeritud nii, et `is_needed = true` tooted on **eespool**
  - `createProduct(storeId, name)` – uue toote lisamine
  - `toggleProductNeeded(id, isNeeded)` – „vaja juurde“ märke muutmine
  - *(valikuline)* `updateProduct(id, name)`, `deleteProduct(id)`
- [ ] **Valideerimine**
  - Tühja nimega poodi ega toodet ei saa lisada
  - Nimedest eemaldatakse algus- ja lõputühikud
- [ ] **Veahaldus**
  - Funktsioonid tagastavad selge veateate, mida frontend saab kasutajale näidata
- [ ] **Turvalisus**
  - Kontrolli koos Supabase'i poolega, et Row Level Security (RLS) reeglid on paigas
#### Sorteerimise näide
 
```ts
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('store_id', storeId)
  .order('is_needed', { ascending: false })
  .order('name', { ascending: true });
```
 
 
### Frontend developer
 
Frontendi ülesanne on teha **minimalistlik ja lihtsasti kasutatav** kasutajaliides. Kindlaid disaininõudeid ei ole, kuid allolevad vaated ja funktsioonid peavad olemas olema.
 
#### Avaleht (`/`)
 
- [ ] Poodide / tootjate **loetelu**
- [ ] Iga pood on klikitav ja viib poe lehele (`/stores/[id]`)
- [ ] **Uue poe lisamise** vorm (nimeväli + nupp „Lisa“)
- [ ] Tühja loetelu korral sõnum, nt „Poode pole veel lisatud“
#### Poe leht (`/stores/[id]`)
 
- [ ] Poe nimi pealkirjana
- [ ] Tagasi-link avalehele
- [ ] Selle poe **toodete nimekiri**
- [ ] Iga toote kõrval **checkbox** „vaja juurde“
- [ ] „Vaja juurde“ märgitud tooted on **nimekirja alguses** ja visuaalselt eristatud (nt paksus kirjas või värviga)
- [ ] Märke muutmisel uueneb nimekirja järjekord kohe
- [ ] **Uue toote lisamise** vorm (nimeväli + nupp „Lisa“)
- [ ] Tühja nimekirja korral sõnum, nt „Selles poes pole veel tooteid“
#### Üldine
 
- [ ] Kujundus on lihtne, selge ja töötab hästi ka **mobiilis** (kosmeetik kasutab seda tõenäoliselt poes telefonist)
- [ ] Laadimise ja vea olekud on kasutajale nähtavad
- [ ] Vormi saab saata ka **Enter**-klahviga
- [ ] *(valikuline)* poe ja toote muutmine / kustutamine
 
