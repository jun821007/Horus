const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3200').replace(/\/$/, '')

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text) as { error?: string; ok?: boolean }
    if (typeof j.error === 'string') return j.error
  } catch { /* ignore */ }
  return text || res.statusText
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error('無法連線後端，請確認 Netlify 的 VITE_API_BASE_URL 與 Railway CORS_ORIGIN')
    }
    throw e
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(await parseApiError(res))
  return res.json() as Promise<T>
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await parseApiError(res))
  return res.json() as Promise<T>
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await parseApiError(res))
  return res.json() as Promise<T>
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseApiError(res))
  return res.json() as Promise<T>
}

export async function ingestInput(text: string, imageFile?: File) {
  const form = new FormData()
  form.append('text', text)
  if (imageFile) form.append('image', imageFile)
  const res = await fetch(`${BASE}/api/ingest`, { method: 'POST', body: form })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? res.statusText)
  return json
}
