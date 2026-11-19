/**
 * Andmekujud, mida HTTP API (app/api/**) tagastab.
 * Need vastavad frontendi lepingule (kosmeetika-app/frontend/lib/types.ts).
 */
import type { Product, Store, StoreWithCounts, StoreWithProducts } from "@/lib/data/types";

export type ProductDto = { id: string; storeId: string; name: string; needed: boolean };
export type StoreSummaryDto = { id: string; name: string; productCount: number; neededCount: number };
export type StoreDetailDto = { id: string; name: string; products: ProductDto[] };

export function toProductDto(p: Product): ProductDto {
  return { id: p.id, storeId: p.store_id, name: p.name, needed: p.is_needed };
}

export function toStoreSummaryDto(s: StoreWithCounts | Store): StoreSummaryDto {
  return {
    id: s.id,
    name: s.name,
    productCount: "product_count" in s ? s.product_count : 0,
    neededCount: "needed_count" in s ? s.needed_count : 0,
  };
}

export function toStoreDetailDto(s: StoreWithProducts): StoreDetailDto {
  return { id: s.id, name: s.name, products: s.products.map(toProductDto) };
}
