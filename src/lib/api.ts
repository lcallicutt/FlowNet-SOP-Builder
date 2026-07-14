import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";

/**
 * Uniform JSON error handling for route handlers. Raw stack traces are never
 * returned to clients — unexpected errors are logged server-side and mapped
 * to a generic message.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, code?: string) {
  return NextResponse.json({ error: { message, code } }, { status });
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return jsonError(error.status, error.message);
  }
  if (error instanceof ApiError) {
    return jsonError(error.status, error.message, error.code);
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return jsonError(
      400,
      first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.",
      "validation_error",
    );
  }
  console.error("[api] unexpected error", error);
  return jsonError(500, "Something went wrong on our end. Please try again.", "internal_error");
}
