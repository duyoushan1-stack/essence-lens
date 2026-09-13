# 提案流程動畫規格

## 1. 目的

本規格定義 EssenceLens 提案流程的 UI 動畫層，描述圖片預覽、狀態區與提案卡片之間的視覺轉換。

核心狀態機、API contract、rejection/error 定義與 retry 規則仍以 [`proposal-status.md`](./proposal-status.md) 為準。本文件不新增產品流程狀態，也不改變 Server pipeline。

## 2. Design Read

這是 EssenceLens 的留白型 premium consumer landing page，保留既有冷色背景、圓角 surface 與 split-screen 結構，使用中等強度、具目的性的狀態轉場。

設計 dial：

```text
DESIGN_VARIANCE: 6
MOTION_INTENSITY: 6
VISUAL_DENSITY: 3
```

動畫應服務於「流程正在發生」與「內容位置發生變化」，不使用無意義的循環動畫或裝飾性位移。

## 3. 範圍

### 包含

- 將「生成提案」放到圖片預覽資訊列，緊鄰「移除」。
- `ready` 時不顯示空白 result panel。
- `ready → pending` 時，intro 淡出，圖片預覽移至主要視覺位置，右側顯示狀態訊息。
- `pending → success / rejected / error` 時，只替換右側內容，不重跑主要圖片位移。
- `pending` 時顯示與 Proposal card 結構對齊的 Skeleton loader，讓使用者先看到結果版面。
- success 時保留最多三張提案卡的堆疊、切換與 Pagination dots。
- success 卡片預留圖片區，尚未有圖片資料時使用原始圖片 fallback；卡片內文疊在圖片下半部。
- desktop 與 mobile 的不同目標位置。
- View Transition API、CSS fallback 與 reduced-motion 行為。
- 元件卸載、換圖、移除與 retry 的動畫清理。

### 不包含

- Provider 狀態或 Server pipeline stage 的新增。
- SSE、WebSocket、polling 或真實的中間進度事件。
- GSAP 或其他大型動畫套件；結果卡片使用 CSS transition 與原生 focus state。
- 圖片、proposal 或 request 的永久保存。
- 將動畫狀態放入 Pinia 或 shared business type。

## 4. 元件與檔案責任

```text
app/
├─ assets/css/main.css
│  └─ 共用 transition token、View Transition 與 reduced-motion 規則
├─ components/
│  ├─ image-upload/
│  │  ├─ ImageUploadPanel.vue
│  │  └─ ImagePreview.vue
│  └─ proposal/
│     ├─ ProposalFlowStage.vue
│     ├─ ProposalCardStack.vue
│     ├─ ProposalSkeleton.vue
│     └─ ProposalCard.vue
└─ composables/
   └─ useProposalAnimation.ts
```

| 檔案                      | 單一責任                                                                      |
| ------------------------- | ----------------------------------------------------------------------------- |
| `index.vue`               | 組合既有 flow state、事件與 slots，不直接操作動畫 DOM                         |
| `ProposalFlowStage.vue`   | 提供 intro、image、status/result slots，依 flow state 選擇 layout class       |
| `useProposalAnimation.ts` | 封裝 View Transition、fallback、reduced-motion 與 active transition cleanup   |
| `ProposalCardStack.vue`   | 限制最多三筆資料，管理 active card、堆疊位置與 Pagination 切換               |
| `ProposalSkeleton.vue`    | 顯示 pending 期間的 Proposal card 結構 placeholder，不建立 Proposal data       |
| `ProposalCard.vue`        | 管理單張卡片的 translate、rotate、scale、opacity 與 reduced-motion transition |
| `ImagePreview.vue`        | 顯示預覽、檔案資訊與更換/生成/移除操作列                                      |
| `ProposalResultPanel.vue` | 顯示 pending、rejected、error 與 success 內容                                 |
| `main.css`                | 放跨元件共用的動畫 token 與無障礙 fallback                                    |

靜態版面、容器寬度、欄位間距與卡片外觀優先使用既有 Tailwind utilities；`main.css` 只保留跨元件共用的 transition token、View Transition 與細部 animation。`useProposal` 不可引用 `document`、`window` 或任何動畫 class。`ProposalFlowStage` 不可呼叫 API，也不可判斷 rejection/error。

## 5. Flow state 到 layout 的 mapping

動畫只讀取核心流程狀態，推導出不可持久化的 layout：

```ts
type ProposalLayout = 'initial' | 'focused'
```

```text
idle / validating / ready → initial
pending / rejected / error / success → focused
```

### Initial layout

```text
desktop: 左側 ProposalIntro，右側 ImageUploadPanel
mobile:  ProposalIntro 在上，ImageUploadPanel 在下
```

### Focused layout

```text
desktop: 左側圖片預覽，右側 pending / rejection / error / proposal result
mobile:  ProposalIntro 淡出，圖片預覽移到文字下方，結果內容接續顯示
```

`ready` 不渲染空白 `ProposalResultPanel`。結果區只有在 `pending`、`rejected`、`error` 或 `success` 時出現。

`rejected` 的預設 layout 仍是 focused，適用於 Server 回傳的圖片可行性或內容安全拒絕；瀏覽器端檔案驗證失敗則由 `keepInitialLayout` 保持 initial，讓使用者留在原地看到檔案錯誤文字。這是 presentation hint，不是新增 flow state。

## 6. 操作列規格

圖片預覽底部資訊列固定排列：

```text
檔名與尺寸       更換圖片   生成提案   移除
```

- 「生成提案」只在 `ready` 可用。
- `pending` 時三個操作全部 disabled。
- 「生成提案」沿用既有 `GenerateProposalButton`，只改變掛載位置與外觀，不複製一份按鈕。
- 操作列不因 loading 另增一個 placeholder card。

## 7. 動畫執行時序

```text
ready
  → 使用者點擊「生成提案」
  → useProposal 立即設定 pending 並發送 request
  → ProposalFlowStage 推導 focused layout
  → useProposalAnimation 執行 layout transition
  → intro 淡出、preview 移動、右側顯示 pending message

pending
  → Server 回傳 success / rejected / error
  → ProposalFlowStage 保持 focused layout
  → 右側以 content transition 替換 pending message
```

規則：

1. 動畫不可阻塞 request，request 與動畫同時開始。
2. View Transition 支援時，preview element 保持相同 `view-transition-name`，由瀏覽器計算位置與尺寸變化。
3. View Transition 不支援時，使用 `main.css` 定義的 opacity、transform 與 layout transition fallback。
4. `pending` 期間不假造「圖片驗證完成」等中間事件；目前 request/response API 只顯示統一 pending 文案。
5. `pending → success` 不重跑 intro-to-preview movement，只替換內容區。
6. `pending → rejected/error` 保持 focused layout，顯示對應訊息與操作。

### Pending Proposal skeleton

`pending` 期間由 `ProposalResultPanel` 顯示 `ProposalSkeleton`，不 mount `ProposalCardStack`，也不建立假的 `Proposal`。

Skeleton 結構需與實際卡片的主要版面一致：

```text
Proposal card shell
  ├─ cover image placeholder
  ├─ proposal index placeholder
  ├─ title placeholder
  ├─ summary placeholder
  ├─ morning / noon / afternoon itinerary placeholders
  └─ location link placeholder
```

- Skeleton 只使用固定尺寸與中性色塊，不填入假標題、假地點或過期 Proposal 內容。
- Placeholder 保留卡片圓角、封面比例、內容間距與三段行程的視覺節奏。
- `ProposalCardStack` 與 `ProposalSkeleton` 共用 `min-h-[35rem] w-full max-w-[28rem]` 的 Tailwind 尺寸，內容不可因封面區而被裁切，短 viewport 時由頁面自然滾動承載完整卡片。
- pending 與 success 使用相同的 Tailwind 卡片寬度，避免結果狀態造成卡片寬度跳動。
- Skeleton surface 使用接近 `bg-surface/85` 的淺色 surface，不使用 `bg-ink` 深色卡片背景。
- 使用輕量 pulse 或 shimmer 表示 loading；不使用大幅位移、旋轉或跳動。
- Skeleton 不可攔截互動，也不顯示收藏、分頁或外部連結控制項。
- Pending 狀態不顯示額外 status 文案，以 `aria-busy="true"` 與 Skeleton 表示處理中；Skeleton 本身設為 `aria-hidden="true"`。
- `pending → success` 時以 content transition 替換成真實 `ProposalCardStack`。
- `pending → rejected/error` 時移除 Skeleton，顯示對應狀態內容。
- `prefers-reduced-motion: reduce` 時保留靜態 placeholder，不播放 pulse 或 shimmer。

本專案不因 Skeleton loader 引入 Vuetify；視覺與 animation token 使用既有 Tailwind utilities 與 `main.css`。

## 8. `useProposalAnimation` 規格

概念介面：

```ts
interface ProposalAnimationController {
  runLayoutTransition(update: () => void | Promise<void>): Promise<void>
  skipActiveTransition(): void
  isReducedMotion: Readonly<Ref<boolean>>
}
```

實作原則：

- 使用 `document.startViewTransition` 時才存取 browser API，SSR 期間不可執行。
- 同一時間只保留一個 active transition。
- 新 transition 開始前，先 skip 尚未完成的舊 transition。
- 不使用 `setInterval`、長時間 `setTimeout` 或未清理的 `requestAnimationFrame`。
- 不把 active transition reference 暴露給 page 或業務 composable。
- 不支援 View Transition 時，`runLayoutTransition` 仍必須執行 update callback。
- reduced-motion 時略過位移與淡入淡出，只執行必要的 DOM 更新。

## 9. 元件生命週期與清理

| 時機                      | 行為                                           | 清理要求                                  |
| ------------------------- | ---------------------------------------------- | ----------------------------------------- |
| `ProposalFlowStage` mount | 顯示 initial layout，不播放入場動畫            | 不建立全域 listener                       |
| `initial → focused`       | 播放 intro 淡出與 preview 移動                 | 只保留目前 transition reference           |
| focused 內部結果變更      | 只替換右側內容                                 | 完成後釋放 reference                      |
| 使用者更換圖片            | 中止舊 transition，重設 initial layout         | 不殘留 transition promise、timer 或 class |
| 使用者移除圖片            | 中止舊 transition，再移除 preview/result       | 不對已卸載元件更新 DOM                    |
| error retry               | 保持 focused layout，清理舊 content transition | 顯示新的 pending 內容                     |
| `onBeforeUnmount`         | 呼叫 `skipActiveTransition`                    | 不殘留 browser transition 或事件 listener |

換圖與移除的清理順序固定為：

```text
skip active animation
  → 清除動畫 reference
  → 清除或重設 card stack local state
  → 更新 business state
  → 讓 Vue 正常卸載/重建 DOM
```

動畫層不能自行清除 `File`、`previewUrl`、proposal 或 API error；這些資料仍由既有 composable 負責。

移除圖片時先重設 proposal state，等待一個 Vue render tick，再清除 upload file，讓 initial layout 的回程轉場先取得穩定的 DOM 起點；接著由既有 upload composable 負責撤銷 preview URL。

## 10. Proposal card stack

`ProposalCardStack` 只在 `success` 且收到 proposals 時 mount：

```ts
proposals: Proposal[] // 1 至 3 張
```

行為：

- 最多顯示三張真實 proposal，資料不足時不複製同一筆湊數。
- 三張卡片維持堆疊，只有 active card 顯示完整內容；使用 Pagination dots 切換 active card。
- active card 可點擊或使用 Enter / Space 切到下一張，非 active card 不攔截互動。
- 圖片封面比例固定，標題與摘要固定疊在圖片底部，行程文字使用 ellipsis 避免溢出。
- 行程列顯示左側 icon，地點若有已驗證的 `externalUrl` 才呈現可點擊連結。
- 離開 `success`、換圖或移除圖片時元件卸載，元件內的收藏 UI state 自然清除。
- 卡片收藏按鈕與地點連結維持鍵盤 focus style。

Success contract 使用 `Proposal[]`，最多回傳三張真實 proposal；這是卡片 stack 所需的資料 contract，不是新增狀態。

## 11. Accessibility 與 reduced motion

- pending/result 容器維持既有 `aria-live` 與 `aria-busy`。
- 動畫不可是傳達狀態的唯一方式，文字結果必須在 DOM 中可讀取。
- 收藏按鈕與地點連結需有可讀 label、keyboard focus 與 disabled 狀態。
- `prefers-reduced-motion: reduce` 時不執行 View Transition、位移、旋轉或 stagger。
- reduced-motion 下仍保留內容順序與可用操作。

## 12. 測試情境

| Case | 預期                                                                         |
| ---- | ---------------------------------------------------------------------------- |
| A-01 | `ready → pending`：intro 淡出、preview 進入 focused layout、pending 文案出現 |
| A-02 | `pending → success`：不重跑主要位移，只替換為 card stack                      |
| A-03 | `pending → rejected/error`：顯示正確內容，不顯示過期 proposal                |
| A-04 | 換圖：中止舊 transition，回到 initial，無殘留 reference/class/timer          |
| A-05 | 移除圖片：先完成 initial layout 回程轉場，再卸載 preview，不觸發卸載後更新   |
| A-06 | retry：保持 focused，清除舊內容並顯示 pending                                |
| A-07 | reduced-motion：不執行位移與 View Transition，內容仍正常顯示                 |
| A-08 | 不支援 View Transition：fallback 仍可完成 layout 與結果顯示                  |
| A-09 | 一至三張 proposal 維持 card stack，Pagination 可切換 active card，資料不足時不複製卡片 |
| A-10 | pending 期間操作列全部 disabled，不能觸發第二個 request                      |
| A-11 | client 檔案驗證失敗：停留 initial layout，只顯示檔案錯誤文字，不播放位移動畫 |
| A-12 | pending 期間顯示 Proposal skeleton，不顯示假的 Proposal 或過期結果            |
| A-13 | pending 結束後 skeleton 正確替換成 success、rejected 或 error 內容             |
| A-14 | reduced-motion 時 skeleton 保持靜態，不播放 pulse 或 shimmer                   |

## 13. 驗收條件

- [ ] 動畫規格與核心狀態機規格分離。
- [ ] 「生成提案」位於圖片資訊列，緊鄰「移除」。
- [ ] `ready` 不顯示空白 result card。
- [ ] 動畫封裝在 `ProposalFlowStage` 與 `useProposalAnimation`。
- [ ] `useProposal` 不直接操作 DOM 或動畫 class。
- [ ] desktop 與 mobile 都定義 preview 目標位置。
- [ ] View Transition 不支援時仍可正常使用。
- [ ] reduced-motion 行為已定義並測試。
- [ ] pending 期間顯示與 Proposal card 對齊的 Skeleton loader。
- [ ] Skeleton 不建立假的 Proposal，也不取代 `Proposal[]` API contract。
- [ ] 換圖、移除、retry、unmount 都會清理 active transition。
- [ ] card stack 只渲染實際收到的 proposals，並保留 Pagination 與 active index reset。
- [ ] 動畫不新增 Provider stage 或業務 state。

## 14. MVP 後再處理

- 真實 pipeline stage progress。
- SSE、WebSocket 或 polling。
- 中斷 Server request。
- 卡片拖曳、滑動手勢與物理彈簧。
- 超過三張 proposal 的分頁或虛擬化。
- 跨頁保存卡片排序或收藏位置。
