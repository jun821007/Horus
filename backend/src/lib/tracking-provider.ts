/** 物流貨態查詢介面（可替換為真實 API / 爬蟲） */
export type TrackingQueryResult = {
  delivered: boolean
  statusText: string
}

export async function queryCarrierStatus(
  carrier: string,
  trackingNumber: string,
): Promise<TrackingQueryResult> {
  // 生產環境：接入新竹 / 黑貓 / 超商官方或第三方 API
  // 開發模式：TRACKING_MOCK_DELIVERED=單號列表 模擬到貨
  const mockList = (process.env.TRACKING_MOCK_DELIVERED ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (mockList.includes(trackingNumber)) {
    return { delivered: true, statusText: '已送達（mock）' }
  }

  // 預設：維持運輸中
  return { delivered: false, statusText: `${carrier} 查詢中` }
}
