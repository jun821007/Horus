const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export class TrackingHttpSession {
  private cookies = new Map<string, string>()

  private storeCookies(res: Response, url: string): void {
    const raw = res.headers.getSetCookie?.() ?? []
    const list = raw.length > 0 ? raw : splitSetCookieHeader(res.headers.get('set-cookie'))
    for (const line of list) {
      const part = line.split(';')[0]?.trim()
      if (!part) continue
      const eq = part.indexOf('=')
      if (eq <= 0) continue
      this.cookies.set(part.slice(0, eq), part.slice(eq + 1))
    }
    void url
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  async get(url: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers)
    headers.set('User-Agent', UA)
    const cookie = this.cookieHeader()
    if (cookie) headers.set('Cookie', cookie)
    const res = await fetch(url, { ...init, headers, redirect: 'follow' })
    this.storeCookies(res, url)
    return res
  }

  async getText(url: string): Promise<string> {
    const res = await this.get(url)
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
    return res.text()
  }

  async getBuffer(url: string): Promise<Buffer> {
    const res = await this.get(url)
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  async postForm(url: string, body: Record<string, string>, referer?: string): Promise<string> {
    const headers = new Headers({
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    })
    if (referer) headers.set('Referer', referer)
    const cookie = this.cookieHeader()
    if (cookie) headers.set('Cookie', cookie)
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: new URLSearchParams(body).toString(),
      redirect: 'follow',
    })
    this.storeCookies(res, url)
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`)
    return res.text()
  }
}

function splitSetCookieHeader(raw: string | null): string[] {
  if (!raw) return []
  return raw.split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function absUrl(base: string, href: string): string {
  return new URL(href, base).toString()
}
