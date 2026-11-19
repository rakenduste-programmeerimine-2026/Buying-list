import * as products from "@/lib/data/products";
import { revalidateStores, withDb } from "@/lib/actions/run";
import { toProductDto } from "@/lib/http/dto";
import { readMutationBody } from "@/lib/http/request";
import { errorResponse, json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/stores/:id/products – poe tooted („vaja juurde“ eespool). */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const result = await withDb("GET /api/stores/:id/products", (db) => products.getProductsByStore(db, id));
  if (!result.ok) return errorResponse(result);
  return json(result.data.map(toProductDto));
}

/** POST /api/stores/:id/products { name } – uue toote lisamine. */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readMutationBody(request);
  if (!body.ok) return errorResponse(body);

  const result = await withDb("POST /api/stores/:id/products", (db) =>
    products.createProduct(db, id, body.body.name),
  );
  if (!result.ok) return errorResponse(result);
  revalidateStores(result.data.store_id);
  return json(toProductDto(result.data), 201);
}
