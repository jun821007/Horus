import * as cheerio from 'cheerio'
import { recognizeDigitsCaptcha } from './captcha-ocr.js'
import { isArrivedStatus, isCaptchaError, isNoData } from './delivered.js'
import { absUrl, sleep, TrackingHttpSession } from './http-session.js'
import { followHctRedirect } from './hct-redirect.js'

const SEARCH_URL = 'https://www.hct.com.tw/Search/SearchGoods_n.aspx'

export type ScrapeResult = {
  delivered: boolean
  statusText: string
  events: string[]
}

function pickViewState(html: string): { viewState: string; viewStateGenerator: string } {
  const $ = cheerio.load(html)
  const viewState = $('input#__VIEWSTATE').attr('value') ?? ''
  const viewStateGenerator = $('input#__VIEWSTATEGENERATOR').attr('value') ?? ''
  if (!viewState) throw new Error('HCT: missing __VIEWSTATE')
  return { viewState, viewStateGenerator }
}

function extractHctEvents(html: string, trackingNumber: string): string[] {
  const $ = cheerio.load(html)
  const events: string[] = []

  $('.grid-container').each((_, block) => {
    const time = $(block).find('.col_optime').first().text().replace(/\s+/g, ' ').trim()
    const state = $(block).find('.col_state .linkInv, .col_state .linkInv2').first().text().replace(/\s+/g, ' ').trim()
    if (!time || !state) return
    events.push(`${time} · ${state}`)
  })

  if (events.length > 0) return events

  $('table tr').each((_, row) => {
    const cells = $(row)
      .find('td, th')
      .map((__, td) => $(td).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean)
    if (cells.length < 2) return
    const line = cells.join(' · ')
    if (/\d{4}[/-]\d{2}[/-]\d{2}|\d{2}:\d{2}|正常配交|到著|配達|集貨|發送|持回|拒收|配送|取件|送達|順利送達/.test(line)) {
      events.push(line)
    }
  })

  if (events.length === 0) {
    const text = $.text().replace(/\s+/g, ' ')
    if (text.includes(trackingNumber)) {
      const statusBits = text.match(/(正常配交|到著|配達|配送中|集貨|發送|持回|拒收|取件|送達)[^。\n]{0,50}/g)
      if (statusBits?.length) events.push(statusBits[statusBits.length - 1])
    }
  }

  return events
}

function isHctMetaLine(line: string): boolean {
  return /查貨號碼|查貨時間/.test(line) && !/配送|配達|到著|集貨|發送|送達|正常配交|取件|持回|拒收/.test(line)
}

function pickLatestEvent(events: string[]): string | null {
  const real = events.filter((e) => !isHctMetaLine(e))
  if (real.length === 0) return null
  return real[0] ?? real[real.length - 1] ?? null
}

function parseHctResult(html: string, trackingNumber: string): ScrapeResult | null {
  const $ = cheerio.load(html)
  const text = $.text()

  if (isCaptchaError(html) || isCaptchaError(text)) return null
  if (isNoData(text)) {
    return { delivered: false, statusText: '查無貨態', events: [] }
  }

  const events = extractHctEvents(html, trackingNumber)
  if (events.length === 0) {
    const statusBits = text.match(/(正常配交|到著|配達|配送中|集貨|發送|持回|拒收|取件|送達)[^。\n]{0,50}/g)
    if (statusBits?.length) {
      const latest = statusBits[statusBits.length - 1]
      return {
        delivered: isArrivedStatus('新竹物流', latest),
        statusText: latest,
        events: statusBits,
      }
    }
    return null
  }

  const latest = pickLatestEvent(events)
  if (!latest) {
    const statusBits = text.match(/(正常配交|到著|配達|配送中|集貨|發送|持回|拒收|取件|送達)[^。\n]{0,50}/g)
    if (statusBits?.length) {
      const fallback = statusBits[statusBits.length - 1]
      return {
        delivered: isArrivedStatus('新竹物流', fallback),
        statusText: fallback,
        events: statusBits,
      }
    }
    return { delivered: false, statusText: '暫無貨態明細', events: [] }
  }
  return {
    delivered: isArrivedStatus('新竹物流', latest),
    statusText: latest,
    events,
  }
}

export async function queryHctPublicTracking(
  trackingNumber: string,
  maxAttempts = 12,
): Promise<ScrapeResult> {
  let lastError = '新竹查詢失敗'

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const session = new TrackingHttpSession()
    try {
      const searchHtml = await session.getText(SEARCH_URL)
      const { viewState, viewStateGenerator } = pickViewState(searchHtml)
      const captchaUrl = absUrl(SEARCH_URL, `BuildCaptchaN.aspx?t=${Date.now()}`)
      const captchaBuf = await session.getBuffer(captchaUrl)

      if (!captchaBuf.slice(0, 3).toString().startsWith('GIF') && captchaBuf[0] !== 0x89) {
        lastError = '新竹驗證碼圖片異常'
        continue
      }

      let code: string
      try {
        code = await recognizeDigitsCaptcha(captchaBuf)
      } catch (e) {
        lastError = e instanceof Error && e.message.includes('not an image')
          ? '新竹驗證碼圖片異常'
          : '新竹驗證碼辨識失敗'
        continue
      }

      const body: Record<string, string> = {
        __VIEWSTATE: viewState,
        __VIEWSTATEGENERATOR: viewStateGenerator,
        'ctl00$ContentFrame$txtpKey': trackingNumber,
        'ctl00$ContentFrame$txtpKey2': '',
        'ctl00$ContentFrame$txtpKey3': '',
        'ctl00$ContentFrame$txtpKey4': '',
        'ctl00$ContentFrame$txtpKey5': '',
        'ctl00$ContentFrame$txtpKey6': '',
        'ctl00$ContentFrame$txtpKey7': '',
        'ctl00$ContentFrame$txtpKey8': '',
        'ctl00$ContentFrame$txtpKey9': '',
        'ctl00$ContentFrame$txtpKey10': '',
        'ctl00$ContentFrame$txt_chk': code,
        'ctl00$ContentFrame$Button1': '查詢 >',
      }

      const resultHtml = await session.postForm(SEARCH_URL, body, SEARCH_URL)
      const finalHtml = await followHctRedirect(session, resultHtml, SEARCH_URL)
      const parsed = parseHctResult(finalHtml, trackingNumber)
      if (parsed) return parsed
      lastError = isCaptchaError(resultHtml) ? '新竹驗證碼錯誤' : '新竹查詢未回結果'
    } catch (e) {
      lastError = e instanceof Error ? e.message : '新竹查詢失敗'
    }
    if (attempt < maxAttempts) await sleep(400)
  }

  return { delivered: false, statusText: lastError, events: [] }
}
