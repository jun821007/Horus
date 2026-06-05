import dns from 'node:dns/promises'
import { config, validateSupabaseUrl } from '../config.js'
import { formatError } from './errors.js'

export type SupabaseCheckResult = {
  ok: boolean
  env: {
    hasUrl: boolean
    hasServiceKey: boolean
    serviceKeyLength: number
    urlHost: string | null
    urlFormatError: string | null
  }
  dns: { ok: boolean; addresses?: string[]; error?: string }
  fetch: { ok: boolean; status?: number; error?: string }
  hint?: string
}

export async function checkSupabaseConnection(): Promise<SupabaseCheckResult> {
  const url = config.supabaseUrl
  const key = config.supabaseServiceKey
  const urlFormatError = validateSupabaseUrl(url)

  let urlHost: string | null = null
  try {
    if (url) urlHost = new URL(url).hostname
  } catch {
    /* invalid url handled below */
  }

  const result: SupabaseCheckResult = {
    ok: false,
    env: {
      hasUrl: Boolean(url),
      hasServiceKey: Boolean(key),
      serviceKeyLength: key.length,
      urlHost,
      urlFormatError,
    },
    dns: { ok: false },
    fetch: { ok: false },
  }

  if (!url || !key) {
    result.hint = 'Railway Variables 需設定 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY'
    return result
  }
  if (urlFormatError) {
    result.hint = urlFormatError
    return result
  }
  if (key.length < 80) {
    result.hint = 'SUPABASE_SERVICE_ROLE_KEY 長度異常，請確認複製的是 service_role（Reveal 後整段貼上）'
    return result
  }

  try {
    const records = await dns.lookup(urlHost!, { all: true })
    result.dns = {
      ok: true,
      addresses: records.map((r) => `${r.address} (${r.family === 6 ? 'IPv6' : 'IPv4'})`),
    }
  } catch (e) {
    result.dns = { ok: false, error: formatError(e) }
    result.hint =
      'DNS 解析失敗：請確認 SUPABASE_URL 的專案代號正確，且 Supabase 專案未暫停（Dashboard 若顯示 Paused 請 Restore）'
    return result
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(15_000),
    })
    result.fetch = { ok: true, status: res.status }
    result.ok = true
    return result
  } catch (e) {
    result.fetch = { ok: false, error: formatError(e) }
    const err = formatError(e)
    if (/enetunreach|econnrefused|network is unreachable/i.test(err)) {
      result.hint =
        'Railway 無法連到 Supabase（常見 IPv6 問題）。請確認 URL 是 https://xxxxx.supabase.co（不是 db.xxx 資料庫位址），並 Redeploy。'
    } else if (/enotfound/i.test(err)) {
      result.hint = '找不到 Supabase 主機：Project URL 代號可能填錯'
    } else {
      result.hint = '連線失敗：請到 Supabase → Settings → API 重新複製 Project URL 與 service_role'
    }
    return result
  }
}
