import { ApiError, type Api, type Product, type StoreDetail, type StoreSummary } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, `Päring ebaõnnestus (${res.status})`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const enc = encodeURIComponent;

export const httpApi: Api = {
  listStores: () => request<StoreSummary[]>("/stores"),
  createStore: (name) =>
    request<StoreSummary>("/stores", { method: "POST", body: JSON.stringify({ name }) }),
  getStore: (id) => request<StoreDetail>(`/stores/${enc(id)}`),
  deleteStore: (id) => request<void>(`/stores/${enc(id)}`, { method: "DELETE" }),
  addProduct: (storeId, name) =>
    request<Product>(`/stores/${enc(storeId)}/products`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  setNeeded: (productId, needed) =>
    request<Product>(`/products/${enc(productId)}`, {
      method: "PATCH",
      body: JSON.stringify({ needed }),
    }),
  deleteProduct: (productId) => request<void>(`/products/${enc(productId)}`, { method: "DELETE" }),
  clearNeeded: (storeId) =>
    request<void>(`/stores/${enc(storeId)}/clear-needed`, { method: "POST" }),
};
