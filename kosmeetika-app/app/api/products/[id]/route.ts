import * as products from "@/lib/data/products";
import { revalidateStores, withDb } from "@/lib/actions/run";
import { toProductDto } from "@/lib/http/dto";
import { checkSameOrigin, readMutationBody } from "@/lib/http/request";
import { errorResponse, json, noContent } from "@/lib/http/respond";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/products/:id
 *   { needed: boolean }  – „vaja juurde“ märke muutmine
 *   { name: string }     – nime muutmine
 * Mõlemad võib saata korraga.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readMutationBody(request);
  if (!body.ok) return errorResponse(body);

  // Üks UPDATE mõlema väljaga: muudatus ei saa jääda pooleli.
  const result = await withDb("PATCH /api/products/:id", (db) =>
    products.updateProductFields(db, id, { name: body.body.name, isNeeded: body.body.needed }),
  );
  if (!result.ok) return errorResponse(result);
  revalidateStores(result.data.store_id);
  return json(toProductDto(result.data));
}

/** DELETE /api/products/:id – toote kustutamine. */
export async function DELETE(request: Request, { params }: Ctx) {
  const originError = checkSameOrigin(request);
  if (originError) return errorResponse(originError);
  const { id } = await params;

  const result = await withDb("DELETE /api/products/:id", (db) => products.deleteProduct(db, id));
  if (!result.ok) return errorResponse(result);
  revalidateStores(result.data.store_id);
  return noContent();
}
