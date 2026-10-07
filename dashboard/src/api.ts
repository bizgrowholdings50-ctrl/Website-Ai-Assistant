const API_BASE = window.location.origin;

export async function api<T = Record<string, unknown>>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      window.location.assign('/admin/login');
    }
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export function getApiBase(): string {
  return API_BASE;
}
