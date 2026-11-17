/**
 * fetch() for admin client components that must NOT fail silently. Several
 * row actions used to fire-and-refresh, so a 401 (expired session), 404 or
 * 500 looked exactly like success. Returns a readable error string instead
 * of throwing; never throws on network failure either.
 */
export async function adminFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    return { ok: false, error: 'Network error — check your connection and try again.' }
  }
  const body = await res.json().catch(() => null)
  if (res.ok) return { ok: true, data: body as T }
  const raw = body && typeof body === 'object' ? (body as { error?: unknown }).error : null
  const error =
    typeof raw === 'string'
      ? raw
      : res.status === 401 || res.status === 403
        ? 'Your session has expired — sign in again.'
        : `Request failed (${res.status})`
  return { ok: false, error }
}
