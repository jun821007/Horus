import type { Carrier } from '../carrier.js'

const SEVEN_ELEVEN_ARRIVED = [/配達門市/, /配達取件門市/, /成功取件/, /已完成/]
const HCT_ARRIVED = [/正常配交/, /缺件配交/, /缺件配達/, /到站自領/, /順利送達/, /送達/]
const T_CAT_ARRIVED = [/配完/, /已配達/, /順利送達/]

export function isArrivedStatus(carrier: Carrier | string, statusText: string): boolean {
  const text = statusText.trim()
  if (!text) return false
  if (carrier === '超商') return SEVEN_ELEVEN_ARRIVED.some((re) => re.test(text))
  if (carrier === '新竹物流') return HCT_ARRIVED.some((re) => re.test(text))
  if (carrier === '黑貓') return T_CAT_ARRIVED.some((re) => re.test(text))
  return false
}

export function isCaptchaError(htmlOrText: string): boolean {
  return (
    (/驗證碼/.test(htmlOrText) && /(錯誤|不正確|輸入)/.test(htmlOrText)) ||
    /alert\s*\(\s*['"]驗證碼錯誤['"]\s*\)/.test(htmlOrText)
  )
}

export function isNoData(htmlOrText: string): boolean {
  return /查無/.test(htmlOrText) || /無貨況/.test(htmlOrText) || /無資料/.test(htmlOrText)
}
