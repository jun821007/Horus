import dotenv from 'dotenv'

dotenv.config()

const trim = (key: string): string => process.env[key]?.trim() ?? ''

const required = (key: string): string => {
  const v = trim(key)
  if (!v) throw new Error(`Missing env: ${key}`)
  return v
}

export const config = {
  port: Number(process.env.PORT ?? 3200),
  corsOrigin: trim('CORS_ORIGIN') || '*',
  cronSecret: trim('CRON_SECRET'),
  geminiApiKey: trim('GEMINI_API_KEY'),
  geminiFlashModel: trim('GEMINI_FLASH_MODEL') || 'gemini-3.5-flash',
  geminiProModel: trim('GEMINI_PRO_MODEL') || 'gemini-3.5-flash',
  supabaseUrl: trim('SUPABASE_URL'),
  supabaseServiceKey: trim('SUPABASE_SERVICE_ROLE_KEY'),
  appTimeZone: trim('APP_TIMEZONE') || 'Asia/Taipei',
  zhApiBaseUrl: trim('ZH_API_BASE_URL'),
  zhHorusReadSecret: trim('ZH_HORUS_READ_SECRET'),
  zhAppUrl: trim('ZH_APP_URL'),
  instockApiBaseUrl: trim('INSTOCK_API_BASE_URL'),
  instockHorusReadSecret: trim('INSTOCK_HORUS_READ_SECRET'),
  instockAppUrl: trim('INSTOCK_APP_URL'),
  orderToolApiBaseUrl: trim('ORDER_TOOL_API_BASE_URL'),
  orderToolHorusReadSecret: trim('ORDER_TOOL_HORUS_READ_SECRET'),
  orderToolAppUrl: trim('ORDER_TOOL_APP_URL'),
  posApiBaseUrl: trim('POS_API_BASE_URL'),
  trackingScrapeEnabled: trim('TRACKING_SCRAPE_ENABLED') !== 'false',
  trackingMockDelivered: (trim('TRACKING_MOCK_DELIVERED') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trackingMaxRetries: Math.max(1, Number(process.env.TRACKING_MAX_RETRIES ?? 12) || 12),
  trackingQueryDelayMs: Math.max(0, Number(process.env.TRACKING_QUERY_DELAY_MS ?? 1500) || 1500),
}

export function validateSupabaseUrl(url: string): string | null {
  if (!url) return 'SUPABASE_URL 未設定'
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'SUPABASE_URL 誤填成 Database 連線字串，請改填 Project URL（https://xxxxx.supabase.co）'
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
    return 'SUPABASE_URL 格式應為 https://你的專案代號.supabase.co（在 Supabase → Settings → API → Project URL）'
  }
  return null
}

export function assertBackendConfig(): void {
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    console.warn('[horus] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — DB routes will fail')
  } else {
    const urlErr = validateSupabaseUrl(config.supabaseUrl)
    if (urlErr) console.warn(`[horus] ${urlErr}`)
  }
  if (!config.geminiApiKey) {
    console.warn('[horus] GEMINI_API_KEY not set — AI ingest will fail')
  }
}

