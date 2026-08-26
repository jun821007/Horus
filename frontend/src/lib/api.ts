const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3200').replace(/\/$/, '')

const TOKEN_KEY = 'horus_auth_token'

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY)
    else localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text) as { error?: string; ok?: boolean }
    if (typeof j.error === 'string') return j.error
  } catch { /* ignore */ }
  return text || res.statusText
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  const token = getAuthToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return headers
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    const headers = authHeaders(init?.headers)
    return await fetch(input, {
      ...init,
      headers,
      credentials: 'include',
    })
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

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await parseApiError(res))
  return res.json() as Promise<T>
}

export async function ingestInput(text: string, imageFile?: File) {
  const form = new FormData()
  form.append('text', text)
  if (imageFile) form.append('image', imageFile)
  const res = await apiFetch(`${BASE}/api/ingest`, { method: 'POST', body: form })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? res.statusText)
  return json
}

export type SessionResponse = {
  ok: boolean
  authenticated: boolean
  username?: string
}

export async function fetchSession(): Promise<SessionResponse> {
  return apiGet<SessionResponse>('/api/auth/session')
}

export async function loginRequest(username: string, password: string, remember: boolean) {
  const res = await apiFetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, remember }),
  })
  const json = await res.json() as { ok?: boolean; error?: string; token?: string; username?: string }
  if (!res.ok) throw new Error(json.error ?? res.statusText)
  if (remember && json.token) setAuthToken(json.token)
  else setAuthToken(null)
  // Cookie may be blocked cross-site: verify session; if cookie fails keep bearer token
  if (json.token) {
    const withBearer = await apiGet<SessionResponse>('/api/auth/session').catch(() => null)
    if (!withBearer?.authenticated) {
      setAuthToken(json.token)
    } else if (!remember) {
      // session via cookie works; drop bearer if not remembering
      setAuthToken(null)
    } else {
      setAuthToken(json.token)
    }
  }
  return json
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiPost('/api/auth/logout')
  } finally {
    setAuthToken(null)
  }
}
