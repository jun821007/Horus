import { config } from '../config.js'
import { fetchIntegrationJson } from '../lib/integration-fetch.js'

export type LifeCountdownItem = {
  id: string
  title: string
  due_date: string
  days_until: number
  days_label: string
  subtitle: string | null
  deep_link: string | null
}

type LifeCountdownResponse = {
  ok: boolean
  count: number
  next: LifeCountdownItem | null
  items: LifeCountdownItem[]
}

export async function fetchLifeCountdowns(): Promise<LifeCountdownResponse | null> {
  if (!config.lifeApiBaseUrl || !config.lifeHorusReadSecret) return null
  return fetchIntegrationJson<LifeCountdownResponse>(
    config.lifeApiBaseUrl,
    '/api/horus/countdowns',
    config.lifeHorusReadSecret,
  )
}
