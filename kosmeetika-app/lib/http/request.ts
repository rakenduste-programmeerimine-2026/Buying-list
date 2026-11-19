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
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return failure("FORBIDDEN", "Päring teiselt saidilt ei ole lubatud.");
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return failure("FORBIDDEN", "Päring teiselt saidilt ei ole lubatud.");
  }
  if (!host || originHost !== host) {
    return failure("FORBIDDEN", "Päring teiselt saidilt ei ole lubatud.");
  }
  return null;
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
