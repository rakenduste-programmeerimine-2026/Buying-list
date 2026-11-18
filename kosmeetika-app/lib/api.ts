import { httpApi } from "./api-http";
import { mockApi } from "./api-mock";
import type { Api } from "./types";

/** Ainus koht, kust komponendid andmeid võtavad. */
export const api: Api = process.env.NEXT_PUBLIC_USE_MOCK === "true" ? mockApi : httpApi;
