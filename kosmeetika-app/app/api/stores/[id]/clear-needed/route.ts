// Next.js nõuab marsruute app/ kaustas. Kood ise on backend/ kaustas.
// Segmendi seadistus peab olema siin failis endas (Next loeb seda staatiliselt).
export const dynamic = "force-dynamic";
export { POST } from "@/backend/app/api/stores/[id]/clear-needed/route";
