import * as cheerio from 'cheerio'
import { absUrl, sleep, TrackingHttpSession } from './http-session.js'

export function parseHctRedirectForm(html: string, baseUrl: string): { action: string; fields: Record<string, string> } | null {
  const $ = cheerio.load(html)
  const form = $('form[name="frm1"], form[action*="SearchGoods"]').first()
  if (!form.length) return null
  const action = form.attr('action') ?? 'SearchGoods.aspx'
  const fields: Record<string, string> = {}
  form.find('input[name]').each((_, el) => {
    const name = $(el).attr('name')
    if (name) fields[name] = $(el).attr('value') ?? ''
  })
  if (!fields.no) return null
  return { action: absUrl(baseUrl, action), fields }
}

export async function followHctRedirect(session: TrackingHttpSession, html: string, baseUrl: string): Promise<string> {
  const redirect = parseHctRedirectForm(html, baseUrl)
  if (!redirect) return html
  await sleep(200)
  return session.postForm(redirect.action, redirect.fields, baseUrl)
}
