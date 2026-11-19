import * as products from "@/lib/data/products";
import { revalidateStores, withDb } from "@/lib/actions/run";
import { failure } from "@/lib/data/result";
import { validateBoolean, validateName } from "@/lib/data/validation";
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

  const hasName = "name" in body.body;
  const hasNeeded = "needed" in body.body;
  if (!hasName && !hasNeeded) {
    return errorResponse(failure("VALIDATION", "Päringus peab olema „name“ või „needed“."));
  }

  // Kontrolli mõlemad väljad enne, et vigane „needed“ ei jätaks poolikut muudatust.
  if (hasNeeded) {
    const flag = validateBoolean(body.body.needed);
    if (!flag.ok) return errorResponse(flag);
  }
  if (hasName) {
    const name = validateName(body.body.name, "product");
    if (!name.ok) return errorResponse(name);
  }

  const result = await withDb("PATCH /api/products/:id", async (db) => {
    if (hasName) {
      const renamed = await products.updateProduct(db, id, body.body.name);
      if (!renamed.ok || !hasNeeded) return renamed;
    }
    return products.toggleProductNeeded(db, id, body.body.needed);
  });
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
