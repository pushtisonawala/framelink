import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Standard error shape returned by every API route. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const Errors = {
  unauthorized: (msg = "Authentication required") =>
    new HttpError(401, "unauthorized", msg),
  forbidden: (msg = "You do not have permission to perform this action") =>
    new HttpError(403, "forbidden", msg),
  notFound: (msg = "Resource not found") => new HttpError(404, "not_found", msg),
  badRequest: (msg = "Invalid request", details?: unknown) =>
    new HttpError(400, "bad_request", msg, details),
  conflict: (msg = "Resource already exists") => new HttpError(409, "conflict", msg),
  tooManyRequests: (msg = "Too many attempts, please try again later") =>
    new HttpError(429, "too_many_requests", msg),
  payloadTooLarge: (msg = "File is too large") =>
    new HttpError(413, "payload_too_large", msg),
  unsupportedMedia: (msg = "Unsupported file type") =>
    new HttpError(415, "unsupported_media_type", msg),
  internal: (msg = "Something went wrong") => new HttpError(500, "internal_error", msg),
};

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown): NextResponse<ApiError> {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: err.flatten(),
        },
      },
      { status: 422 },
    );
  }
  // Unknown — log server-side, don't leak details.
  console.error("[api] unhandled error:", err);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong" } },
    { status: 500 },
  );
}

/** Wrap a route handler so thrown HttpError / ZodError become clean responses. */
export function handler<Ctx>(
  fn: (req: Request, ctx: Ctx) => Promise<NextResponse> | NextResponse,
) {
  return async (req: Request, ctx: Ctx): Promise<NextResponse> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function parseJson<T>(req: Request, schema: {
  parse: (v: unknown) => T;
}): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw Errors.badRequest("Request body must be valid JSON");
  }
  return schema.parse(body);
}
