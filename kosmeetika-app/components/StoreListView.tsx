"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { productsLabel, storeColor } from "@/lib/format";
import type { StoreSummary } from "@/lib/types";

export default function StoreListView() {
  const [stores, setStores] = useState<StoreSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setStores(await api.listStores());
      setError(null);
    } catch {
      setError("Poodide laadimine ebaõnnestus. Proovi leht uuesti laadida.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await api.createStore(trimmed);
      setName("");
      setAdding(false);
      await load();
    } catch {
      setError("Poe lisamine ebaõnnestus. Proovi uuesti.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setAdding(false);
      setName("");
    }
  }

  return (
    <>
      <h1>Kosmeetika märkmik</h1>
      <p className="sub">
        {stores && stores.length > 0
          ? "Vali pood, et näha, mida sealt osta."
          : "Lisa pood, et alustada."}
      </p>

      {error && <p className="error" role="alert">{error}</p>}

      {stores === null && !error && <p className="sub">Laen…</p>}
      {stores && stores.length === 0 && <div className="empty">Poode veel pole.</div>}

      {stores && stores.length > 0 && (
        <ul className="plain">
          {stores.map((s) => (
            <li key={s.id} className="bare">
              <Link href={`/stores/${encodeURIComponent(s.id)}`} className="card">
                <span className="dot" style={{ background: storeColor(s.id) }} />
                <span>
                  <b>{s.name}</b>
                  <small>
                    {s.productCount
                      ? `${s.neededCount} vaja osta, kokku ${productsLabel(s.productCount)}`
                      : "Tooteid pole"}
                  </small>
                </span>
                <span className="go" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form className="row addbox" onSubmit={onSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Poe nimi, nt Douglas"
            aria-label="Poe nimi"
            maxLength={40}
          />
          <button type="submit" className="primary" disabled={busy}>Salvesta</button>
        </form>
      ) : (
        <button type="button" className="primary wide" onClick={() => setAdding(true)}>
          + Lisa pood
        </button>
      )}
    </>
  );
}
