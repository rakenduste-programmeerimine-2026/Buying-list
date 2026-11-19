import * as stores from "@/lib/data/stores";
import { revalidateStores, withDb } from "@/lib/actions/run";
import { toStoreDetailDto, toStoreSummaryDto } from "@/lib/http/dto";
import { checkSameOrigin, readMutationBody } from "@/lib/http/request";
import { errorResponse, json, noContent } from "@/lib/http/respond";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/stores/:id – pood koos toodetega („vaja juurde“ eespool). */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const result = await withDb("GET /api/stores/:id", (db) => stores.getStoreWithProducts(db, id));
  if (!result.ok) return errorResponse(result);
  return json(toStoreDetailDto(result.data));
}

/** PATCH /api/stores/:id { name } – poe nime muutmine. */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readMutationBody(request);
  if (!body.ok) return errorResponse(body);

  const result = await withDb("PATCH /api/stores/:id", (db) => stores.updateStore(db, id, body.body.name));
  if (!result.ok) return errorResponse(result);
  revalidateStores(result.data.id);
  return json(toStoreSummaryDto(result.data));
}

/** DELETE /api/stores/:id – poe ja selle toodete kustutamine. */
export async function DELETE(request: Request, { params }: Ctx) {
  const originError = checkSameOrigin(request);
  if (originError) return errorResponse(originError);
  const { id } = await params;

  const result = await withDb("DELETE /api/stores/:id", (db) => stores.deleteStore(db, id));
  if (!result.ok) return errorResponse(result);
  revalidateStores(result.data.id);
  return noContent();
}
