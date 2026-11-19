import type { Product } from "./types";

const COLORS = ["#b03a6f", "#2f8f7d", "#d98a1f", "#5a6fd6", "#c0504d", "#7a4fb0", "#3c9bb5", "#8a8f2a"];

/** Poe värv tuletatakse id-st, nii et backend seda hoidma ei pea. */
export function storeColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function productsLabel(n: number): string {
  return n === 1 ? "1 toode" : `${n} toodet`;
}

/** Märgitud ("vaja osta") tooted nimekirja algusse, ülejäänud järjekord jääb samaks. */
export function sortNeededFirst(products: Product[]): Product[] {
  return [...products].sort((a, b) => Number(b.needed) - Number(a.needed));
}
