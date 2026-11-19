import { NextResponse } from "next/server";
import type { ErrorCode, Failure } from "@/lib/data/result";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFIG: 503,
  UNKNOWN: 500,
};

const NO_STORE = { "Cache-Control": "no-store" };

export function statusFor(code: ErrorCode): number {
  return STATUS[code];
}

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

/** Veavastus kujul `{ error, code }`, mida frontend saab kasutajale näidata. */
export function errorResponse(failure: Failure): NextResponse {
  return NextResponse.json(
    { error: failure.error, code: failure.code },
    { status: statusFor(failure.code), headers: NO_STORE },
  );
}
