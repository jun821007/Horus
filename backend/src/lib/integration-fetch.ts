export async function fetchIntegrationJson<T>(
  baseUrl: string,
  path: string,
  secret: string,
  query?: Record<string, string | number>,
): Promise<T> {
  const root = baseUrl.replace(/\/$/, '')
  const url = new URL(path.startsWith('/') ? path.slice(1) : path, `${root}/`)
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${path} ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}
