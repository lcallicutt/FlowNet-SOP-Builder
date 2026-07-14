/**
 * Tiny client-side fetch helper for the app's JSON API routes.
 * All routes return `{ error: { message, code } }` on failure.
 */
export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }

  const body = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: string } })
    | null;

  if (!res.ok) {
    throw new Error(
      body?.error?.message ?? `Request failed (${res.status}).`,
    );
  }
  return body as T;
}
