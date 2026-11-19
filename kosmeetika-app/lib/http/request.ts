import { failure, type Failure } from "@/lib/data/result";

/** Päringu keha maksimaalne suurus baitides (nimi on kuni 100 märki). */
export const MAX_BODY_BYTES = 2048;

/**
 * Lihtne CSRF-kaitse muutvatele päringutele (POST/PATCH/DELETE).
 *
 * Brauser saadab `Origin` ja `Sec-Fetch-Site` päised. Kui päring tuleb teiselt
 * saidilt, lükatakse see tagasi. Päisteta päringud (nt curl) lubatakse, sest
 * CSRF puudutab ainult brausereid.
 */
export function checkSameOrigin(request: Request): Failure | null {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return crossSite();

  const origin = request.headers.get("origin");
  if (!origin) return null;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return crossSite();
  }

  // Proksi taga (Vercel, nginx, Cloudflare) on päris host x-forwarded-host päises.
  // See võib sisaldada mitut väärtust („a.ee, b.ee“) ja vaikimisi porti („a.ee:443“).
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  // Skeem kuulub päritolu juurde: http://sait ≠ https://sait.
  if (forwardedProto && originUrl.protocol !== `${forwardedProto}:`) return crossSite();
  if (!host || normalizeHost(originUrl.host, originUrl.protocol) !== normalizeHost(host, originUrl.protocol)) {
    return crossSite();
  }
  return null;
}

function crossSite(): Failure {
  return failure("FORBIDDEN", "Päring teiselt saidilt ei ole lubatud.");
}

/** Väiketähed ja vaikimisi port (http:80, https:443) eemaldatud. */
export function normalizeHost(host: string, protocol: string): string {
  const h = host.trim().toLowerCase();
  const defaultPort = protocol === "https:" ? ":443" : protocol === "http:" ? ":80" : null;
  return defaultPort && h.endsWith(defaultPort) ? h.slice(0, -defaultPort.length) : h;
}

/**
 * Loeb JSON-keha. Nõuab `Content-Type: application/json` (see takistab ka
 * lihtsaid HTML-vormi CSRF-rünnakuid) ja piirab keha suurust.
 */
export async function readJsonObject(request: Request): Promise<{ ok: true; body: Record<string, unknown> } | Failure> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return failure("VALIDATION", "Päring peab olema JSON-vormingus.");
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return failure("VALIDATION", "Päring on liiga suur.");

  let text: string;
  try {
    text = await request.text();
  } catch {
    return failure("VALIDATION", "Päringu keha ei õnnestunud lugeda.");
  }
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return failure("VALIDATION", "Päring on liiga suur.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failure("VALIDATION", "Päringu keha ei ole korrektne JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return failure("VALIDATION", "Päringu keha peab olema JSON-objekt.");
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

/** Ühendab päritolu kontrolli ja keha lugemise. */
export async function readMutationBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | Failure> {
  const originError = checkSameOrigin(request);
  if (originError) return originError;
  return readJsonObject(request);
}
