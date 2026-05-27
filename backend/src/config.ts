import dotenv from 'dotenv'

dotenv.config()

const required = (key: string): string => {
  const v = process.env[key]?.trim()
  if (!v) throw new Error(`Missing env: ${key}`)
  return v
}

export const config = {
  port: Number(process.env.PORT ?? 3200),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  cronSecret: process.env.CRON_SECRET ?? '',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiFlashModel: process.env.GEMINI_FLASH_MODEL ?? 'gemini-2.5-flash',
  geminiProModel: process.env.GEMINI_PRO_MODEL ?? 'gemini-2.5-pro',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  appTimeZone: process.env.APP_TIMEZONE ?? 'Asia/Taipei',
}

export function assertBackendConfig(): void {
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    console.warn('[horus] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — DB routes will fail')
  }
  if (!config.geminiApiKey) {
    console.warn('[horus] GEMINI_API_KEY not set — AI ingest will fail')
  }
}
