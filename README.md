# Horus · 荷魯斯之眼

整合型 Web App 矩陣：全域 AI 輸入、台灣單號追蹤、兩階段庫存入庫、荔枝出貨提醒、POS 純毛利。

**基礎建設：** GitHub · Netlify（前端）· Railway（後端 + Cron）· Supabase（資料庫）

## 專案結構

```
Horus/
├── supabase/migrations/001_horus_schema.sql
├── backend/          # Railway Express API
└── frontend/         # Netlify Vite React（像素復古暗色）
```

## 1. Supabase

在 Supabase SQL Editor 執行：

`supabase/migrations/001_horus_schema.sql`

主要資料表：

| 資料表 | 用途 |
|--------|------|
| `shipping_tracks` | 台灣物流單號（主鍵 `tracking_number`） |
| `inventory_drafts` | 淘寶 OCR 待確認入庫 |
| `inventories` | 實際庫存 |
| `financial_expenses` | 採購成本支出 |
| `reminders` | 提醒 / 到貨 / 出貨預警 |
| `lychee_shipments` | 荔枝出貨單 + `target_ship_date` |
| `daily_profits` | POS 純毛利 |

## 2. Railway 後端

```bash
cd backend
cp ../.env.example .env   # 填入變數
npm install
npm run dev
```

### Cron（Railway Scheduled Jobs）

以 HTTP POST 觸發（Header: `x-cron-secret: <CRON_SECRET>`）：

| 路徑 | 說明 |
|------|------|
| `POST /cron/tracking-daily` | 每日查詢物流，到貨寫入提醒 |
| `POST /cron/ship-reminder` | 篩選明天 `target_ship_date`，發出貨預警 |
| `POST /cron/daily` | 合併執行上述兩項 |

範例（curl）：

```bash
curl -X POST "https://YOUR_APP.up.railway.app/cron/daily" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

物流查詢預設為「運輸中」；開發可用 `TRACKING_MOCK_DELIVERED=8531039226` 模擬到貨。

## 3. Netlify 前端

```bash
cd frontend
npm install
# 建立 frontend/.env：
# VITE_API_BASE_URL=...
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...
npm run dev
```

圖示：`frontend/public/icon.png`（荷魯斯之眼）

## 模組對照

1. **全域輸入** → `POST /api/ingest`（文字 → Flash；截圖 → Pro）
2. **單號追蹤** → `shipping_tracks` + 每日 Cron
3. **兩階段入庫** → `inventory_drafts` → 確認後寫入 `inventories`
4. **荔枝 / 提醒** → `lychee_shipments` + `reminders` + 下午 Cron
5. **POS 毛利** → `POST /api/pos/checkout` → `daily_profits`（前端 Realtime）

## 與既有 App 的關係

本 repo 為 **Horus 整合層**；既有的「Order number」「in stock」「pos」等可逐步將讀寫改指向 Supabase API，或透過 `/api/ingest` 接收相同格式的輸入。
