/**
 * Shared fetch helper for client-side calls to internal /api/* route handlers.
 * Adds JSON body, throws on non-2xx with the server's `error` message.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    signal,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(path, init);
  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!res.ok) {
    const errMsg =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : null) || `Request failed with status ${res.status}`;
    throw new Error(errMsg);
  }

  // Standard route handler shape: { data: ... }. Return data when present, else full payload.
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
