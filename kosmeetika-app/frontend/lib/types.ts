/** Toode ühe poe märkmikus. `needed` = märgitud kui "vaja osta" (tähtis). */
export type Product = {
  id: string;
  storeId: string;
  name: string;
  needed: boolean;
};

/** Poe rida avalehel. */
export type StoreSummary = {
  id: string;
  name: string;
  productCount: number;
  neededCount: number;
};

/** Ühe poe leht koos toodetega. */
export type StoreDetail = {
  id: string;
  name: string;
  products: Product[];
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Leping frontendi ja andmekihi vahel.
 * Backendi poole peale on vaja ainult selle liidese taga olevaid päringuid
 * (vt lib/api-http.ts ja README.md).
 */
export interface Api {
  listStores(): Promise<StoreSummary[]>;
  createStore(name: string): Promise<StoreSummary>;
  /** Peab viskama ApiError(404), kui poodi pole. */
  getStore(id: string): Promise<StoreDetail>;
  deleteStore(id: string): Promise<void>;
  addProduct(storeId: string, name: string): Promise<Product>;
  setNeeded(productId: string, needed: boolean): Promise<Product>;
  deleteProduct(productId: string): Promise<void>;
  /** Võtab poe kõikidelt toodetelt "vaja osta" märke maha. */
  clearNeeded(storeId: string): Promise<void>;
}
