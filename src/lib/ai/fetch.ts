type QueryValue = string | number | boolean | Date | undefined | null;
type Query = Record<string, QueryValue>;

function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const url = path + buildQuery(query);
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    const message =
      typeof json === "object" && json !== null && "message" in json
        ? String((json as { message: unknown }).message)
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return (json as { data: T }).data;
}

export function apiGet<T>(path: string, query?: Query): Promise<T> {
  return request<T>("GET", path, undefined, query);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}
