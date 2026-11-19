import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Product, Tables } from "@/types/database";

export type DbClient = SupabaseClient<Database>;

/** Pood, nagu backend selle tagastab (omaniku ID-d frontendile ei anta). */
export type Store = Pick<Tables<"stores">, "id" | "name" | "created_at">;

/** Pood koos toodete arvuga (avalehe loetelu jaoks). */
export type StoreWithCounts = Store & {
  product_count: number;
  needed_count: number;
};

/** Pood koos sorteeritud toodetega (poe lehe jaoks). */
export type StoreWithProducts = Store & {
  products: Product[];
};

export type { Product };
