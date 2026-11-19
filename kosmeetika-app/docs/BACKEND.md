# Backend (Next.js + Supabase)

Backend ühendab Next.js rakenduse Supabase'iga ja annab frontendile valmis
funktsioonid poodide ja toodete haldamiseks. Kõik on kaustas `kosmeetika-app/`,
samas Next.js projektis, kus on frontend.

## Ülevaade

```
Brauser (frontend, Frontend-Markus haru)
   │  fetch /api/...  (lib/api-http.ts, NEXT_PUBLIC_USE_MOCK=false)
   ▼
app/api/**/route.ts        HTTP API, sama leping mis frontendi lib/types.ts
lib/actions/*.ts           Server Actions ("use server"), kui frontend tahab neid otse kasutada
   │
   ▼
lib/data/*.ts              andmeloogika: valideerimine, päringud, veateated (testitav)
   │
   ▼
lib/supabase/server.ts     Supabase'i serveri klient (@supabase/ssr, küpsised)
   │
   ▼
Supabase (Postgres + RLS + Auth)
```

`middleware.ts` värskendab igal päringul sessiooni ja loob uuele seadmele
**anonüümse kasutaja**. Nii on igal seadmel oma privaatne nimekiri ja frontendis
ei pea olema sisselogimise vormi.

## Seadistamine

### 1. Keskkonnamuutujad

```bash
cd kosmeetika-app
npm install
cp .env.example .env.development.local
```

Täida `NEXT_PUBLIC_SUPABASE_URL` ja `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(Supabase → Project Settings → API Keys) ning pane `NEXT_PUBLIC_USE_MOCK=false`.
Uuemates projektides võib anon-võtme asemel panna
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...` (seda eelistatakse).

> Miks `.env.development.local`, mitte `.env.local`? Frontendi harus on
> `.env.local` gitis (`NEXT_PUBLIC_USE_MOCK=true`). Next.js eelistab
> `.env.development.local` faili, seega frontendi faili ei pea muutma ja sinu
> võtmed ei lähe kogemata gitti. Tootmises (`npm run build`) kasuta
> `.env.production.local` faili või hostingu keskkonnamuutujaid.

🔒 Kasuta **ainult** anon/publishable võtit. `service_role` / `sb_secret_` võti ei
tohi kunagi olla `NEXT_PUBLIC_` muutujas ega frontendis (rakendus keeldub
käivitumast, kui seal on `sb_secret_` võti).

### 2. Supabase'i seaded (teeb Supabase'i poole inimene)

1. **Authentication → Sign In / Providers → Allow anonymous sign-ins**: sisse.
2. **Authentication → Rate Limits → Anonymous sign-ins**: anonüümsed kasutajad
   luuakse Next.js serverist, seega Supabase näeb kõiki külastajaid ühe IP-na.
   Vaikimisi piir (30 tunnis) on ühe kosmeetiku jaoks piisav; avalikuks
   kasutamiseks tõsta see (nt 300). Robotid ja lingi eelvaated kasutajat ei loo.
3. **Authentication → URL Configuration → Redirect URLs**: lisa
   `http://localhost:3000/auth/callback` ja tootmisaadress.
4. SQL Editoris käivita järjest:
   - `supabase/sql/00_check_rls.sql` – vaata, mis praegu kehtib (ei muuda midagi)
   - `supabase/sql/01_constraints.sql` – nimede piirangud andmebaasis + indeks
   - `supabase/sql/02_rls_auth.sql` – `user_id` veerg + RLS reeglid
5. Pärast seda **Advisors → Security Advisor** ei tohiks näidata
   „RLS disabled“ hoiatusi.

> ⚠️ Olemasolevad read jäävad pärast `02_rls_auth.sql` ilma omanikuta ja
> muutuvad nähtamatuks. Failis on juhend, kuidas neile omanik määrata.

### 3. Tüübid

`types/database.ts` vastab README andmemudelile + `user_id` veerule. Pärast
skeemi muutmist genereeri need uuesti:

```bash
npx supabase gen types typescript --project-id <projekti-id> > types/database.ts
```

## Funktsioonid (Server Actions)

Kõik funktsioonid tagastavad sama kuju:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode };
```

`error` on eestikeelne teade, mida võib kasutajale otse näidata.

### `lib/actions/stores.ts`

| Funktsioon | Kirjeldus |
| --- | --- |
| `getStores()` | kõik poed tähestiku järjekorras |
| `getStoresWithCounts()` | poed + `product_count`, `needed_count` |
| `getStoreById(id)` | ühe poe andmed (`NOT_FOUND`, kui pole) |
| `getStoreWithProducts(id)` | pood + sorteeritud tooted |
| `createStore(name)` | uue poe lisamine |
| `updateStore(id, name)` | nime muutmine |
| `deleteStore(id)` | poe ja selle toodete kustutamine (CASCADE) |
| `createStoreFromForm(prev, formData)` | `useActionState` variant (väli `name`) |

### `lib/actions/products.ts`

| Funktsioon | Kirjeldus |
| --- | --- |
| `getProductsByStore(storeId)` | „vaja juurde“ eespool, siis nime järgi |
| `createProduct(storeId, name)` | uue toote lisamine (`NOT_FOUND`, kui poodi pole) |
| `toggleProductNeeded(id, isNeeded)` | „vaja juurde“ märke muutmine |
| `updateProduct(id, name)` | nime muutmine |
| `deleteProduct(id)` | toote kustutamine |
| `clearNeededProducts(storeId)` | kõigilt poe toodetelt märke maha |
| `createProductFromForm(prev, formData)` | `useActionState` variant (väljad `storeId`, `name`) |

### `lib/actions/auth.ts` (valmis tulevase sisselogimise vormi jaoks)

| Funktsioon | Kirjeldus |
| --- | --- |
| `getCurrentUser()` | `{ id, email, isAnonymous }` või `null` |
| `upgradeAnonymousUser(email)` | seob anonüümse kasutaja e-postiga, **andmed jäävad alles** |
| `setPassword(password)` | parooli määramine pärast e-posti kinnitamist |
| `signUp(email, password)` / `signIn(email, password)` / `signOut()` | tavaline konto |

Kasutades `upgradeAnonymousUser` + `setPassword`, saab kosmeetik hiljem samale
nimekirjale ligi ka teisest seadmest (telefon + arvuti).

## HTTP API (frontendi leping)

Vastab täpselt frontendi failidele `lib/api-http.ts` ja `lib/types.ts`.

| Meetod | Tee | Keha | Vastus |
| --- | --- | --- | --- |
| GET | `/api/stores` | – | `StoreSummary[]` |
| POST | `/api/stores` | `{ name }` | `201 StoreSummary` |
| GET | `/api/stores/:id` | – | `StoreDetail` (404, kui pole) |
| PATCH | `/api/stores/:id` | `{ name }` | `StoreSummary` |
| DELETE | `/api/stores/:id` | – | `204` |
| GET | `/api/stores/:id/products` | – | `Product[]` |
| POST | `/api/stores/:id/products` | `{ name }` | `201 Product` |
| POST | `/api/stores/:id/clear-needed` | – | `204` |
| PATCH | `/api/products/:id` | `{ needed?, name? }` | `Product` |
| DELETE | `/api/products/:id` | – | `204` |

Veavastus: `{ "error": "Poe nimi ei tohi olla tühi.", "code": "VALIDATION" }`.

| `code` | HTTP | Millal |
| --- | --- | --- |
| `VALIDATION` | 400 | tühi/liiga pikk nimi, vale ID, vigane JSON |
| `UNAUTHORIZED` | 401 | sessioon puudub (laadi leht uuesti) |
| `FORBIDDEN` | 403 | RLS keelas või päring teiselt saidilt |
| `NOT_FOUND` | 404 | poodi/toodet pole (või kuulub teisele kasutajale) |
| `CONFLICT` | 409 | unikaalsuse rikkumine |
| `CONFIG` | 503 | Supabase'i keskkonnamuutujad puuduvad |
| `UNKNOWN` | 500 | muu viga (detailid ainult serveri logis) |

## Sorteerimine

Andmebaas sorteerib nagu ülesandes näidatud (`is_needed desc, name asc`).
Seejärel järjestatakse tulemus **eesti tähestiku** järgi (`Intl.Collator("et")`),
sest Supabase'i vaikimisi collation paneb õ, ä, ö, ü valesse kohta:

- poed: `Apotheka, Douglas, Wella, Õnne pood, Ülo`
- tooted: „vaja juurde“ eespool, mõlemad grupid tähestiku järgi
- suur- ja väiketäht ei mõjuta järjekorda, „Toode 2“ tuleb enne „Toode 10“

## Valideerimine

Reeglid on [Zod](https://zod.dev) skeemides (`lib/data/validation.ts`). Skeemid
(`storeNameSchema`, `productNameSchema` jt) on eksporditud, nii et frontend võib
kasutada täpselt samu reegleid.

- nimest eemaldatakse algus- ja lõputühikud (ka NBSP jms), Unicode normaliseeritakse (NFC)
- tühi nimi → viga; max 100 märki; juhtmärgid (reavahetus, NUL) keelatud
- ID peab olema UUID, `needed`/`isNeeded` peab olema boolean
- sama reegel on ka andmebaasis (`01_constraints.sql`), kui keegi kutsub Supabase'i otse

## Turvalisus

- **RLS**: iga kasutaja näeb ja muudab ainult oma poode ja tooteid; anon-roll ei
  pääse tabelitele üldse ligi; toodet ei saa tõsta teise kasutaja poodi; poe
  omanikku ei saa vahetada. Testitud: `npm run test:db`.
- **Sessioon**: `getClaims()` kontrollib JWT allkirja (asümmeetriliste võtmete
  korral lokaalselt); `getSession()` tulemust serveris ei usaldata.
- **Anonüümsed kasutajad** luuakse ainult tavalise lehe avamisel (mitte API, POST
  ega prefetch päringutega), et piirata massilist loomist.
- **CSRF**: muutvad API päringud nõuavad `Content-Type: application/json` ja
  kontrollivad `Origin` / `Sec-Fetch-Site` päiseid. Server Actions kontrollivad
  päritolu Next.js-is ise.
- **Päringu suurus** max 2 KB; lisaväljad kehas (nt `id`, `user_id`) jäetakse
  tähelepanuta, sest andmebaasi saadetakse ainult lubatud väljad.
- **Vead**: SQL-i ja tabelite detaile kasutajale ei näidata.
- **Open redirect**: `/auth/callback?next=` lubab ainult sama saidi teid.
- **Vahemälu**: API vastustel `Cache-Control: no-store`; sessiooniküpsistega
  vastustele lisab `@supabase/ssr` ise no-cache päised.
- **Turvapäised** (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`;
  `X-Powered-By` on välja lülitatud.
- `lib/supabase/server.ts` impordib `server-only`, seega serveri klienti ei saa
  kogemata brauseri bundle'isse lisada.

## Testid ja kvaliteet

```bash
npm test               # unit + API testid (Vitest), Supabase'i pole vaja
npm run test:coverage  # sama + katvus (piir: 90% ridu/funktsioone, 85% harusid)
npm run typecheck      # TypeScript
npm run lint:backend   # ESLint (typescript-eslint, tüübiteadlik) backendi failidele
npm run check          # kõik ülaltoodud korraga
npm run test:db        # RLS testid lokaalses Postgres'is (PGHOST/PGPORT/PGUSER)
```

GitHub Actions (`.github/workflows/backend.yml`) käivitab iga PR-i peal
typecheck'i, lint'i, testid koos katvusega, RLS testid päris Postgres'is ja
Next.js build'i.

## Teadaolevad piirangud

- Anonüümne kasutaja on seotud seadme küpsisega: teises seadmes on teine nimekiri,
  kuni frontend lisab konto sidumise (`upgradeAnonymousUser`).
- `npm audit` näitab Next.js 15 sõltuvuses (postcss) hoiatust; parandus on Next.js 16,
  mis on suurem uuendus ja tuleks teha koos frontendiga.
