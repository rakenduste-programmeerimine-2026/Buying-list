import * as products from "@/lib/data/products";
import { revalidateStores, withDb } from "@/lib/actions/run";
import { checkSameOrigin } from "@/lib/http/request";
import { errorResponse, noContent } from "@/lib/http/respond";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/stores/:id/clear-needed – võtab poe kõigilt toodetelt „vaja juurde“ märke maha. */
export async function POST(request: Request, { params }: Ctx) {
  const originError = checkSameOrigin(request);
  if (originError) return errorResponse(originError);
  const { id } = await params;

  const result = await withDb("POST /api/stores/:id/clear-needed", (db) => products.clearNeededProducts(db, id));
  if (!result.ok) return errorResponse(result);
  revalidateStores(id);
  return noContent();
}
