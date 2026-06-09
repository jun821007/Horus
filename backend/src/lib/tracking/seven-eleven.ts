import * as cheerio from 'cheerio'
import { recognizeDigitsCaptcha } from './captcha-ocr.js'
import { isArrivedStatus, isCaptchaError, isNoData } from './delivered.js'
import { absUrl, sleep, TrackingHttpSession } from './http-session.js'

const BASE = 'https://eservice.7-11.com.tw/E-Tracking'
const SEARCH_URL = `${BASE}/search.aspx`

export type ScrapeResult = {
  delivered: boolean
  statusText: string
  events: string[]
}

function pickViewState(html: string): { viewState: string; viewStateGenerator: string } {
  const $ = cheerio.load(html)
  const viewState = $('input#__VIEWSTATE').attr('value') ?? ''
  const viewStateGenerator = $('input#__VIEWSTATEGENERATOR').attr('value') ?? ''
  if (!viewState) throw new Error('711: missing __VIEWSTATE')
  return { viewState, viewStateGenerator }
}

function parse711Result(html: string): ScrapeResult | null {
  const $ = cheerio.load(html)
  const page = $('#txtPage').attr('value') ?? $('input[name="txtPage"]').attr('value') ?? '1'
  if (page !== '2') {
    if (isCaptchaError($.text())) return null
    if (isNoData($.text())) {
      return { delivered: false, statusText: '查無貨態', events: [] }
    }
    return null
  }

  const events: string[] = []
  $('div.shipping li').each((_, el) => {
    const line = $(el).text().replace(/\s+/g, ' ').trim()
    if (line) events.push(line)
  })
  events.reverse()

  const latest = events[events.length - 1] ?? '查詢成功'
  return {
    delivered: isArrivedStatus('超商', latest),
    statusText: latest,
    events,
  }
}

export async function querySevenElevenTracking(
  trackingNumber: string,
  maxAttempts = 12,
): Promise<ScrapeResult> {
  let lastError = '711 查詢失敗'

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const session = new TrackingHttpSession()
    try {
      const searchHtml = await session.getText(SEARCH_URL)
      const { viewState, viewStateGenerator } = pickViewState(searchHtml)
      const captchaUrl = absUrl(SEARCH_URL, `ValidateImage.aspx?ts=${Date.now()}`)
      const captchaBuf = await session.getBuffer(captchaUrl)

      if (!captchaBuf.length || !isImageBuffer(captchaBuf)) {
        lastError = '711 驗證碼圖片異常'
        continue
      }

      let code: string
      try {
        code = await recognizeDigitsCaptcha(captchaBuf)
      } catch (e) {
        lastError = e instanceof Error && e.message.includes('not an image')
          ? '711 驗證碼圖片異常'
          : '711 驗證碼辨識失敗'
        continue
      }

      const body: Record<string, string> = {
        __LASTFOCUS: '',
        __EVENTTARGET: '',
        __EVENTARGUMENT: '',
        __VIEWSTATE: viewState,
        __VIEWSTATEGENERATOR: viewStateGenerator,
        txtProductNum: trackingNumber,
        tbChkCode: code,
        aaa: '',
        txtIMGName: '',
        txtPage: '1',
      }

      const resultHtml = await session.postForm(SEARCH_URL, body, SEARCH_URL)
      const parsed = parse711Result(resultHtml)
      if (parsed) return parsed
      lastError = isCaptchaError(resultHtml) ? '711 驗證碼錯誤' : '711 查詢未回結果'
    } catch (e) {
      lastError = e instanceof Error ? e.message : '711 查詢失敗'
    }
    if (attempt < maxAttempts) await sleep(400)
  }

  return { delivered: false, statusText: lastError, events: [] }
}

function isImageBuffer(buf: Buffer): boolean {
  if (buf[0] === 0x89 && buf[1] === 0x50) return true
  if (buf.slice(0, 3).toString() === 'GIF') return true
  if (buf[0] === 0xff && buf[1] === 0xd8) return true
  return false
}
