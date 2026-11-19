// Next.js nõuab marsruute app/ kaustas. Kood ise on backend/ kaustas.
// Segmendi seadistus peab olema siin failis endas (Next loeb seda staatiliselt).
export const dynamic = "force-dynamic";
export { GET } from "@/backend/app/auth/callback/route";
