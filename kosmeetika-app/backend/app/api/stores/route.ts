import * as stores from "@/lib/data/stores";
import { revalidateStores, withDb } from "@/lib/actions/run";
import { toStoreSummaryDto } from "@/lib/http/dto";
import { readMutationBody } from "@/lib/http/request";
import { errorResponse, json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";

/** GET /api/stores – poed tähestiku järjekorras koos toodete arvuga. */
export async function GET() {
  const result = await withDb("GET /api/stores", (db) => stores.getStoresWithCounts(db));
  if (!result.ok) return errorResponse(result);
  return json(result.data.map(toStoreSummaryDto));
}

/** POST /api/stores { name } – uue poe lisamine. */
export async function POST(request: Request) {
  const body = await readMutationBody(request);
  if (!body.ok) return errorResponse(body);

  const result = await withDb("POST /api/stores", (db) => stores.createStore(db, body.body.name));
  if (!result.ok) return errorResponse(result);
  revalidateStores();
  return json(toStoreSummaryDto(result.data), 201);
}
