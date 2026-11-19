import { ApiError, type Api, type Product, type StoreSummary } from "./types";

type Db = { stores: { id: string; name: string }[]; products: Product[] };

const KEY = "kosmeetika-markmik-mock-v1";

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (Array.isArray(parsed.stores) && Array.isArray(parsed.products)) return parsed;
    }
  } catch {
    /* tühi andmebaas */
  }
  return { stores: [], products: [] };
}

function save(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* ignoreeri */
  }
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function summarize(db: Db, store: { id: string; name: string }): StoreSummary {
  const items = db.products.filter((p) => p.storeId === store.id);
  return {
    id: store.id,
    name: store.name,
    productCount: items.length,
    neededCount: items.filter((p) => p.needed).length,
  };
}

/** Brauseris töötav asendus, et frontendi saaks arendada ilma backendita. */
export const mockApi: Api = {
  async listStores() {
    const db = load();
    return db.stores.map((s) => summarize(db, s));
  },
  async createStore(name) {
    const db = load();
    const store = { id: uid(), name };
    db.stores.push(store);
    save(db);
    return summarize(db, store);
  },
  async getStore(id) {
    const db = load();
    const store = db.stores.find((s) => s.id === id);
    if (!store) throw new ApiError(404, "Poodi ei leitud");
    return { id: store.id, name: store.name, products: db.products.filter((p) => p.storeId === id) };
  },
  async deleteStore(id) {
    const db = load();
    db.stores = db.stores.filter((s) => s.id !== id);
    db.products = db.products.filter((p) => p.storeId !== id);
    save(db);
  },
  async addProduct(storeId, name) {
    const db = load();
    if (!db.stores.some((s) => s.id === storeId)) throw new ApiError(404, "Poodi ei leitud");
    const product: Product = { id: uid(), storeId, name, needed: false };
    db.products.push(product);
    save(db);
    return product;
  },
  async setNeeded(productId, needed) {
    const db = load();
    const product = db.products.find((p) => p.id === productId);
    if (!product) throw new ApiError(404, "Toodet ei leitud");
    product.needed = needed;
    save(db);
    return product;
  },
  async deleteProduct(productId) {
    const db = load();
    db.products = db.products.filter((p) => p.id !== productId);
    save(db);
  },
  async clearNeeded(storeId) {
    const db = load();
    db.products.forEach((p) => {
      if (p.storeId === storeId) p.needed = false;
    });
    save(db);
  },
};
