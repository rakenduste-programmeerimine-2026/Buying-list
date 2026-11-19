"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { productsLabel, sortNeededFirst, storeColor } from "@/lib/format";
import { ApiError, type Product, type StoreDetail } from "@/lib/types";

export default function StoreView({ id }: { id: string }) {
  const router = useRouter();
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setStore(await api.getStore(id));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError("Andmete laadimine ebaõnnestus.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addProduct(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const product = await api.addProduct(id, trimmed);
      setStore((s) => (s ? { ...s, products: [...s.products, product] } : s));
      setName("");
      inputRef.current?.focus();
    } catch {
      setError("Toote lisamine ebaõnnestus.");
    }
  }

  async function toggle(p: Product) {
    const next = !p.needed;
    setStore((s) =>
      s ? { ...s, products: s.products.map((x) => (x.id === p.id ? { ...x, needed: next } : x)) } : s,
    );
    try {
      await api.setNeeded(p.id, next);
    } catch {
      setError("Märke salvestamine ebaõnnestus.");
      void load();
    }
  }

  async function remove(p: Product) {
    setStore((s) => (s ? { ...s, products: s.products.filter((x) => x.id !== p.id) } : s));
    try {
      await api.deleteProduct(p.id);
    } catch {
      setError("Toote eemaldamine ebaõnnestus.");
      void load();
    }
  }

  async function clearMarks() {
    setStore((s) => (s ? { ...s, products: s.products.map((x) => ({ ...x, needed: false })) } : s));
    try {
      await api.clearNeeded(id);
    } catch {
      setError("Märkide eemaldamine ebaõnnestus.");
      void load();
    }
  }

  async function deleteStore() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await api.deleteStore(id);
      router.push("/");
    } catch {
      setError("Poe kustutamine ebaõnnestus.");
    }
  }

  if (notFound) {
    return (
      <>
        <Link href="/" className="back">‹ Kõik poed</Link>
        <div className="empty">Seda poodi ei leitud.</div>
      </>
    );
  }

  const products = store ? sortNeededFirst(store.products) : [];
  const neededCount = products.filter((p) => p.needed).length;

  return (
    <>
      <Link href="/" className="back">‹ Kõik poed</Link>

      {store ? (
        <>
          <div className="head">
            <span className="dot" style={{ background: storeColor(store.id) }} />
            <h1>{store.name}</h1>
          </div>
          <p className="sub">
            {products.length
              ? `${neededCount} vaja osta, kokku ${productsLabel(products.length)}. Linnuke tähendab, et seda on vaja juurde osta.`
              : "Kirjuta üles, mida siit saab."}
          </p>
        </>
      ) : (
        !error && <p className="sub">Laen…</p>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {store && (
        <>
          <form className="row addbox" onSubmit={addProduct}>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Toode, nt näokreem"
              aria-label="Toote nimi"
              maxLength={60}
            />
            <button type="submit" className="primary">Lisa toode</button>
          </form>

          {products.length === 0 && <div className="empty">Selles poes pole veel tooteid.</div>}

          <ul className="plain">
            {products.map((p) => (
              <li key={p.id} className={p.needed ? "item need" : "item"}>
                <label>
                  <input
                    type="checkbox"
                    checked={p.needed}
                    onChange={() => void toggle(p)}
                    aria-label={`Vaja osta: ${p.name}`}
                  />
                  <span className="name">{p.name}</span>
                </label>
                <button type="button" className="x" aria-label={`Eemalda ${p.name}`} onClick={() => void remove(p)}>
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div className="foot">
            {neededCount > 0 ? (
              <button type="button" className="link" onClick={() => void clearMarks()}>
                Võta kõik märked maha
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="link danger" onClick={() => void deleteStore()}>
              {confirmDelete ? "Vajuta uuesti, et pood kustutada" : "Kustuta pood"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
