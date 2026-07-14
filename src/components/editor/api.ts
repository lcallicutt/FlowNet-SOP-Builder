/** Shared client-side fetch helpers for the editor and library. */

export type ApiErrorPayload = { message: string; code?: string };

/** Parse a non-OK response's `{ error: { message, code } }` body safely. */
export async function readApiError(
  res: Response,
  fallback: string,
): Promise<ApiErrorPayload> {
  try {
    const data: unknown = await res.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "object" &&
      (data as { error: unknown }).error !== null
    ) {
      const err = (data as { error: { message?: unknown; code?: unknown } }).error;
      return {
        message: typeof err.message === "string" ? err.message : fallback,
        code: typeof err.code === "string" ? err.code : undefined,
      };
    }
  } catch {
    // fall through to fallback
  }
  return { message: fallback };
}
