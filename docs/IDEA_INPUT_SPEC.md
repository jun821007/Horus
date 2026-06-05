# 赫魯斯之眼（Horus）｜想法輸入器模組 — 完整開發規格

> 專案路徑：`C:\Users\rsz97\Horus`  
> 本模組併入 Horus，**不要**併入 Painpoint Hub（痛點回報器）。兩者產品、資料、API 完全分開。

---

## 目錄

1. [Horus 現況](#一horus-現況請先讀再動手)
2. [產品定位與已確認決策](#二產品定位與已確認決策)
3. [使用者故事](#三使用者故事端到端)
4. [介面規格](#四介面規格)
5. [AI 輸出格式](#五ai-輸出格式)
6. [Supabase Schema](#六supabase-schema)
7. [Backend API](#七backend-api)
8. [Frontend / Backend 檔案清單](#八frontend--backend-檔案清單)
9. [分期交付](#九分期交付分-pr-不要一次做滿)
10. [與 Painpoint Hub 邊界](#十與-painpoint-hub-邊界)
11. [環境變數](#十一環境變數)
12. [驗收清單](#十二驗收清單)
13. [明確不做](#十三明確不做)

---

## 一、Horus 現況（請先讀再動手）

### 技術棧

| 層 | 技術 |
|----|------|
| Frontend | React 19 + Vite 6 + TypeScript，**無 React Router**，Tab 切換 SPA |
| Backend | Express 4 + TypeScript（`backend/src/`） |
| DB | Supabase PostgreSQL（`supabase/migrations/`） |
| AI | Gemini（`backend/src/lib/gemini.ts`），Flash 文字 / Pro 圖片 |
| UI | 自訂 pixel 復古風（`frontend/src/styles/pixel.css`），無 Tailwind |
| Auth | 目前**無使用者登入**；後端 service role；RLS permissive `using (true)` |

### 現有模組（Tab）

`frontend/src/App.tsx` 目前有 5 個 Tab：**單號 / 庫存 / 提醒 / 荔枝 / 毛利**  
頂部 **UniversalInput** → `POST /api/ingest` → `dispatch.ts` → 物流／淘寶 OCR。

### 重要：想法輸入器不要走 UniversalInput / `/api/ingest`

- `/api/ingest` 是物流／庫存專用 pipeline
- 想法模組需**獨立 API**（`/api/ideas/*`）+ **獨立 Tab 全屏 Panel**

### 關鍵檔案參考

| 用途 | 路徑 |
|------|------|
| Tab 殼 | `frontend/src/App.tsx` |
| 現有 ingest | `frontend/src/components/UniversalInput.tsx` |
| API 慣例 | `backend/src/routes/api.ts` |
| Ingest 路由（勿改邏輯） | `backend/src/services/dispatch.ts` |
| Gemini 物流 | `backend/src/lib/gemini.ts` |
| 樣式 | `frontend/src/styles/pixel.css` |
| DB migration 001 | `supabase/migrations/001_horus_schema.sql` |

---

## 二、產品定位與已確認決策

**想法輸入器**：隨手輸入念頭 → AI 分類 + 優先建議 + 1～2 行動方案 → 使用者決策 → 累積成敘事地圖與目標任務。

| 項目 | 決策 |
|------|------|
| 歸屬 | 併入 **Horus**，非 Painpoint Hub |
| 入口 | **2A：主站獨立頁**（Horus = 新增 Tab「想法」全屏 Panel；不做全域浮窗 ⚡） |
| AI 產出 | **行動建議**（繁體中文，禁止程式碼／英文／給 Cursor 技術指令） |
| 分類 | **可編輯分類樹**（CRUD + 排序 + 啟停） |
| 儲存 | **Supabase**（新 migration，不動現有 7 張表邏輯） |
| 決策權 | 使用者負責：採用方案一／二、暫緩、丟棄 |
| 對話 UI | **左右分欄**：左 = 使用者輸入與決策，右 = AI 回覆 |

---

## 三、使用者故事（端到端）

1. 切到 Tab「想法」，在左欄輸入想法並送出。
2. 右欄顯示 AI：分類、優先建議（P0/P1/P2 + 理由）、方案一／方案二。
3. 左欄顯示 thread 歷史；右欄顯示 AI 面板與決策按鈕。
4. 點 **採用方案一 / 採用方案二 / 暫緩 / 丟棄**。
5. 「暫緩」進待決策池；P1 可 AI + 手動拖曳排序。
6. P2：採用 idea 掛敘事地圖節點。
7. P3：從採用方案生成目標計劃 + 任務 + 進度追蹤。

---

## 四、介面規格

### §4.1 新增 Tab

在 `App.tsx` 的 `TABS` 新增：

```ts
{ id: 'ideas', label: '想法' }
```

`module === 'ideas'` 時渲染 `<IdeasPanel />`（`frontend/src/components/IdeasPanel.tsx`）。

**不要**改 UniversalInput 行為。

---

### §4.2 IdeasPanel 子 Tab 結構

主 Tab「想法」內，頂部子導覽（沿用 `.module-tabs`，可略小）：

| 子 Tab ID | 標籤 | 階段 | 說明 |
|-----------|------|------|------|
| `chat` | 對話 | P0 | 左右分欄輸入 + AI 回覆 |
| `pending` | 待決策 | P0 | 暫緩池列表 |
| `categories` | 分類 | P0 | 分類樹 CRUD |
| `map` | 地圖 | P2 | 敘事地圖 |
| `goals` | 目標 | P3 | 目標計劃 + 任務 |

P0 只做前三個；P2/P3 未實作時顯示「即將推出」。

---

### §4.3 對話子頁（chat）

#### 布局

```
┌─────────────────────────────────────────────────────────┐
│  [對話] [待決策] [分類]                                   │
├──────────────────────┬──────────────────────────────────┤
│  左：使用者             │  右：AI                           │
│  [textarea]           │  [分類 badge] [優先 badge]        │
│  [送出]               │  ## 方案一 …                      │
│  ── thread ──         │  [採用方案一][採用方案二]          │
│  我：…                │  [暫緩][丟棄]                     │
│  決策：已採用方案一     │  [複製方案一][複製方案二]          │
└──────────────────────┴──────────────────────────────────┘
```

#### 左欄（使用者）

- `textarea` placeholder：「突然想到什麼？直接打…」
- 按鈕 **送出**（`.btn-primary`）；Enter 不送出；Ctrl+Enter 可送出（可選）
- thread 歷史：user 訊息 + 系統決策訊息（「已採用方案一」等）
- 新想法 = 新 `idea_id`；同 idea 補充 = `POST /api/ideas/:id/messages`

#### 右欄（AI）

- 每輪 AI 一張 `.pixel-panel`
- 頂部：**分類 badge** + **優先 badge**（P0 紅 / P1 黃 / P2 灰）
- 每方案：標題、問題點、行動建議、下一步
- 按鈕列：
  - `[採用方案一]` `[採用方案二]` — `.btn-gold`
  - `[暫緩]` `[丟棄]` — `.btn`；丟棄前 confirm
  - `[複製方案一]` `[複製方案二]` — 只複製該方案行動內容（見 §4.8）
- 採用後：該方案區 opacity 降低，按鈕 disabled；左欄追加決策訊息

#### 空狀態 / 載入

- 未選 idea：右欄「輸入想法後，AI 會在這裡回覆」
- POST 中：disable 送出，右欄「思考中…」

#### 從待決策進入

- 待決策列表點一筆 → 切 `chat`，載入該 `idea_id` thread

---

### §4.4 待決策子頁（pending）

#### P0：靜態列表

```
┌─ 待決策 (3) ─────────────────────────────────────┐
│  [P1] 產品 │ 加入發貨地址自動查詢…        06/02  │
│  [P2] 生活 │ 週末整理書房…               06/01  │
└─────────────────────────────────────────────────┘
```

- 每列：優先 badge、分類名、標題、日期
- 點整列 → 進對話子頁

#### P1：拖曳排序 UI

**目的**：手動覆蓋 AI 順序；`priority_manual` 越小越靠前。

**交互**：

- 每列左側拖曳把手 `⋮⋮`（touch ≥44px）
- 滑鼠 drag + 手機 long-press（建議 `@dnd-kit/core` + `@dnd-kit/sortable`）
- 拖曳中：列 `--neon` 邊框
- 放開：`PATCH /api/ideas/reorder` body `{ ids: ['uuid1', ...] }`
- 提示：「拖曳調整優先順序 · AI 建議僅供參考」

**排序規則**：

1. `priority_manual` 升序
2. 同 manual → `priority`（P0 < P1 < P2）
3. 再 → `created_at` desc

**AI Top N 區（P1，列表上方）**：

- 標題「本週建議先做」
- 從 pending 選 Top 3 + 理由一句
- 使用者拖曳後以 manual 為準

**空狀態**：「沒有待決策想法，去對話 Tab 輸入吧」

---

### §4.5 分類設定子頁（categories）— P0

- 樹狀列表（indent 依 `parent_id`）
- 每列：`[↑][↓]`、`[+ 子分類]`、啟用 toggle、`[刪除]`
- 刪除條件：無子節點且無關聯 idea
- 最多 **3 層**；同層不可重名

**預設 seed**：產品、技術、生活、學習、資源、人際、健康、財務、其他

---

### §4.6 敘事地圖子頁（map）— P2

個人「方向 / 資源 / 障礙 / 已採用想法」節點網路，非地理地圖。

| type | 中文 | 樣式 |
|------|------|------|
| `direction` | 方向 | `--gold` |
| `resource` | 資源 | `--neon` |
| `obstacle` | 障礙 | 紅 badge |
| `idea` | 想法 | 連結已採用 idea |

**P2a — 節點樹列表（必做）**

```
▼ 方向：2026 穩定現金流
  ├─ 資源：現有 POS 系統
  ├─ 障礙：時間不足
  └─ 想法：加入發貨地址… [連結]
```

- CRUD 節點；已採用 idea 掛 `ideas.map_node_id`
- 採用 idea 時可彈窗「掛到地圖節點？」（可略過）

**P2b — 關係圖（可選另 PR）**

- `react-flow` 或 CSS grid；位置存 `metadata: { x, y }`
- **P2 先交付 2a**

---

### §4.7 目標子頁（goals）— P3

```
┌─ 目標：建立發貨地址自動查詢 ──── 進行中 ─┐
│ 成功條件：                              │
│  ☑ 能輸入單號自動帶出物流狀態            │
│  ☐ 異常時寫入提醒                       │
│  任務：                                 │
│  ☑ 調研物流 API                         │
│  ☐ 後端 webhook                         │
│  [+ 新增任務]                           │
│  進度 ████░░░░ 40%                      │
└─────────────────────────────────────────┘
```

- 從已採用 idea：`POST /api/ideas/:id/goal`
- AI 拆 3～5 條 success_criteria + 5～10 條 tasks
- checkbox 勾選即 PATCH；進度 = done/total

---

### §4.8 複製按鈕（P0）

**複製方案一 / 二** 純文字格式：

```
【方案一：{標題}】
問題點：
- …
行動建議：
- …
下一步：…
```

- 成功：按鈕「已複製」1.5 秒
- fallback：`textarea` + `execCommand('copy')`

---

### §4.9 響應式與樣式

- 只用 `pixel.css`，不引入 Tailwind
- `@media (max-width: 640px)` 左右分欄改上下堆疊
- 字體：Press Start 2P（標題/按鈕）+ Noto Sans TC（正文）

---

## 五、AI ���出格式

### 顯示用 Markdown（右欄）

```markdown
**分類**：產品
**優先建議**：P1 — 與現有物流模組可協同，影響面中等

## 方案一：調整操作元件順序
**問題點**
- …
**行動建議**
- …
**下一步**
- …

## 方案二：…
```

**禁止**：程式碼區塊、英文、寒暄、給 Cursor 技術指令。

### 結構化 JSON（後端 parse）

Gemini 輸入：使用者文字 + **啟用中分類樹 JSON**（id, name, parent_id）

```json
{
  "category_id": "uuid",
  "priority": "P1",
  "priority_reason": "…",
  "title": "…",
  "plans": [
    {
      "plan_index": 1,
      "title": "…",
      "problem_points": ["…"],
      "actions": ["…"],
      "next_step": "…"
    }
  ]
}
```

- 模型：`GEMINI_FLASH_MODEL`（預設 `gemini-2.5-flash`）
- 邏輯放 `backend/src/lib/gemini-ideas.ts` 或 `services/ideas.ts`
- **不要**塞進 `classifyAndParse` 的 tracking/taobao prompt

---

## 六、Supabase Schema

新增：`supabase/migrations/002_ideas_schema.sql`

### `idea_categories`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | gen_random_uuid() |
| parent_id | uuid nullable | FK → idea_categories |
| name | text | 不可空白 |
| sort_order | int | default 0 |
| is_active | boolean | default true |
| created_at, updated_at | timestamptz | |

### `ideas`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | |
| title | text | AI 摘要 |
| status | text | draft / pending / adopted / archived |
| category_id | uuid | FK |
| priority | text | P0 / P1 / P2 |
| priority_manual | int nullable | 手動排序 |
| adopted_plan_index | int nullable | 1 or 2 |
| map_node_id | uuid nullable | P2 |
| goal_id | uuid nullable | P3 |
| created_at, updated_at | timestamptz | |

### `idea_messages`

| 欄位 | 型別 |
|------|------|
| id, idea_id FK | uuid |
| role | user / assistant / system |
| content | text (markdown) |
| metadata | jsonb |
| created_at | timestamptz |

### `idea_plans`

| 欄位 | 型別 |
|------|------|
| id, idea_id | uuid |
| plan_index | int (1 or 2) |
| title | text |
| problem_points | jsonb |
| actions | jsonb |
| next_step | text |
| created_at | timestamptz |

### P2：`map_nodes`

type: direction / resource / obstacle / idea；title, description, parent_id, sort_order

### P3：`goals`, `goal_tasks`

- goals: idea_id, title, success_criteria jsonb, status
- goal_tasks: goal_id, title, status (todo/doing/done), completion_criteria, sort_order, due_at

### RLS

沿用 Horus：`enable row level security` + permissive policy（單使用者）。

---

## 七、Backend API

路由：`backend/src/routes/ideas.ts`（或掛在 `api.ts`）  
服務：`backend/src/services/ideas.ts`

| 方法 | 路徑 | 階段 | 說明 |
|------|------|------|------|
| GET | `/api/ideas/categories` | P0 | 分類樹 |
| POST | `/api/ideas/categories` | P0 | 新增 |
| PATCH | `/api/ideas/categories/:id` | P0 | 編輯/排序/啟停 |
| DELETE | `/api/ideas/categories/:id` | P0 | 刪除 |
| POST | `/api/ideas` | P0 | `{ text }` → AI → plans |
| GET | `/api/ideas` | P0 | query: status, category_id |
| GET | `/api/ideas/:id` | P0 | messages + plans |
| POST | `/api/ideas/:id/messages` | P0 | 補充 → AI 再回 |
| PATCH | `/api/ideas/:id/decision` | P0 | adopt_1 / adopt_2 / pending / archive |
| PATCH | `/api/ideas/reorder` | P1 | `{ ids: string[] }` |
| POST | `/api/ideas/:id/goal` | P3 | 生成 goal + tasks |

### POST `/api/ideas` 流程

1. insert ideas (draft)
2. insert idea_messages (user)
3. 讀 active categories → Gemini
4. parse → assistant message + idea_plans
5. update idea: category_id, priority, title
6. return `{ ok, idea, messages, plans }`

### PATCH `/api/ideas/:id/decision`

| action | status | 其他 |
|--------|--------|------|
| adopt_1 / adopt_2 | adopted | adopted_plan_index |
| pending | pending | |
| archive | archived | |

回應格式：`{ ok: true, ... }` / `{ ok: false, error }`；驗證用 Zod。

---

## 八、Frontend / Backend 檔案清單

### P0 Frontend

| 動作 | 路徑 |
|------|------|
| 改 | `frontend/src/App.tsx` |
| 新/改 | `frontend/src/components/IdeasPanel.tsx` |
| 新 | `frontend/src/components/IdeaCategorySettings.tsx` |
| 新 | `frontend/src/components/IdeaPendingList.tsx` |
| 改 | `frontend/src/lib/api.ts` |
| 改 | `frontend/src/styles/pixel.css` |

### P0 Backend

| 動作 | 路徑 |
|------|------|
| 新 | `supabase/migrations/002_ideas_schema.sql` |
| 新 | `backend/src/services/ideas.ts` |
| 新 | `backend/src/lib/gemini-ideas.ts` |
| 新 | `backend/src/routes/ideas.ts` |
| 改 | `backend/src/routes/api.ts`（掛載 ideas router） |
| **不動** | `backend/src/services/dispatch.ts` |
| **不動** | `backend/src/lib/gemini.ts`（tracking/taobao） |

---

## 九、分期交付（分 PR）

### P0（第一 PR）

- migration 002 + seed 分類
- categories CRUD + ideas + decision + AI
- Tab「想法」+ chat / pending / categories
- 左右分欄 + 決策四按鈕 + 複製方案一/二

### P1

- 待決策拖曳排序 + reorder API
- AI Top N 建議區
- 列表篩選

### P2

- map_nodes CRUD + 節點樹 UI
- idea 掛載地圖

### P3

- goals + goal_tasks + 進度條
- `POST /api/ideas/:id/goal`

**請 P0 驗收通過後再開 P1，不要一次做滿。**

---

## 十、與 Painpoint Hub 邊界

| Painpoint Hub | Horus 想法輸入器 |
|---------------|------------------|
| Repo `Full-Stack` | `C:\Users\rsz97\Horus` |
| 外掛 ⚡ + 截圖 | Tab 全屏 + 純文字 |
| Google Sheets + GCS | Supabase |
| 給 Cursor 技術方案 | 行動建議 + 決策 |
| app_name 分組 | 分類樹 + 敘事地圖 |

**禁止**共用表、API、或把想法走 `/api/ingest`。

---

## 十一、環境變數

沿用現有，無需新增：

**Backend**：`GEMINI_API_KEY`, `GEMINI_FLASH_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`  
**Frontend**：`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

見 `.env.example`。

---

## 十二、驗收清單

### P0

- [ ] Tab「想法」不影響 UniversalInput 與其他 5 Tab
- [ ] 左右分欄對話正常
- [ ] AI：分類 + P0/P1/P2 + 方案 1～2（繁體、行動建議）
- [ ] 採用／暫緩／丟棄 狀態正確
- [ ] 分類樹 CRUD
- [ ] 待決策池可見 pending
- [ ] 複製方案一／二可用
- [ ] migration 已在 Supabase 執行
- [ ] 物流／庫存／提醒 regression 無壞

### P1

- [ ] 拖曳排序 + reorder API
- [ ] Top N 建議區

### P2

- [ ] map_nodes + 節點樹 + idea 掛載

### P3

- [ ] goal + tasks + 進度

---

## 十三、明確不做

- 不併入 Painpoint Hub
- 不走 `/api/ingest` / UniversalInput
- P2 不做複雜力導向圖（react-flow 可選 PR）
- 不做多使用者 Auth（除非另開 PR）
- 不做全域浮窗 ⚡

---

## 完成 P0 後請回報

1. PR / branch 名
2. `002_ideas_schema.sql` 是否已在 Supabase 執行
3. Railway + Netlify demo URL
4. P1 建議下一 PR 順序
