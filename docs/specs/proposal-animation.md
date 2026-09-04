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
- success 時支援最多三張提案卡的堆疊與切換。
- success 卡片預留圖片區，尚未有圖片資料時使用視覺色塊；切換使用 pagination dots。
- desktop 與 mobile 的不同目標位置。
- View Transition API、CSS fallback 與 reduced-motion 行為。
- 元件卸載、換圖、移除與 retry 的動畫清理。

### 不包含

- Provider 狀態或 Server pipeline stage 的新增。
- SSE、WebSocket、polling 或真實的中間進度事件。
- GSAP 或其他大型動畫套件；卡片 transform 使用已安裝的 `@vueuse/motion`。
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
│     └─ ProposalCard.vue
└─ composables/
   └─ useProposalAnimation.ts
```

| 檔案                      | 單一責任                                                                      |
| ------------------------- | ----------------------------------------------------------------------------- |
| `index.vue`               | 組合既有 flow state、事件與 slots，不直接操作動畫 DOM                         |
| `ProposalFlowStage.vue`   | 提供 intro、image、status/result slots，依 flow state 選擇 layout class       |
| `useProposalAnimation.ts` | 封裝 View Transition、fallback、reduced-motion 與 active transition cleanup   |
| `ProposalCardStack.vue`   | 管理卡片 index、切換操作與卡片視覺堆疊                                        |
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
activeIndex: number   // component local state，預設 0
```

行為：

- 最多顯示三張真實 proposal。
- 頂層卡片可點擊；下方 pagination dots 可直接前往指定卡片。
- 卡片位置、縮放、z-index 與 opacity 由 `activeIndex` 和卡片 index 推導。
- `proposals` 改變時將 `activeIndex` 重設為 `0`。
- 離開 `success`、換圖或移除圖片時元件卸載，local state 自然清除。
- 沒有三筆資料時，不複製同一 proposal 湊成三張。
- 卡片切換不發送 request，也不觸發 retry。
- 必須提供鍵盤可操作的卡片與 pagination dots，以及 focus style。

卡片的 `translate`、`rotate`、`scale` 與 `opacity` 由 `@vueuse/motion` 的 `useMotion` 控制，使用低 stiffness、高 damping 的 spring；非 active 卡片只保留空白 card shell，不渲染標題與描述，避免文字互相堆疊。

Success contract 使用 `Proposal[]`，最多回傳三張真實 proposal；這是卡片堆疊所需的資料 contract，不是新增狀態。

## 11. Accessibility 與 reduced motion

- pending/result 容器維持既有 `aria-live` 與 `aria-busy`。
- 動畫不可是傳達狀態的唯一方式，文字結果必須在 DOM 中可讀取。
- 卡片切換控制項需有可讀 label、keyboard focus 與 disabled 狀態。
- `prefers-reduced-motion: reduce` 時不執行 View Transition、位移、旋轉或 stagger。
- reduced-motion 下仍保留內容順序與可用操作。

## 12. 測試情境

| Case | 預期                                                                         |
| ---- | ---------------------------------------------------------------------------- |
| A-01 | `ready → pending`：intro 淡出、preview 進入 focused layout、pending 文案出現 |
| A-02 | `pending → success`：不重跑主要位移，只替換為 card stack                     |
| A-03 | `pending → rejected/error`：顯示正確內容，不顯示過期 proposal                |
| A-04 | 換圖：中止舊 transition，回到 initial，無殘留 reference/class/timer          |
| A-05 | 移除圖片：先完成 initial layout 回程轉場，再卸載 preview，不觸發卸載後更新   |
| A-06 | retry：保持 focused，清除舊內容並顯示 pending                                |
| A-07 | reduced-motion：不執行位移與 View Transition，內容仍正常顯示                 |
| A-08 | 不支援 View Transition：fallback 仍可完成 layout 與結果顯示                  |
| A-09 | 一至三張 proposal 可透過 pagination dots 切換，資料更新後 index 回到 `0`     |
| A-10 | pending 期間操作列全部 disabled，不能觸發第二個 request                      |
| A-11 | client 檔案驗證失敗：停留 initial layout，只顯示檔案錯誤文字，不播放位移動畫 |

## 13. 驗收條件

- [ ] 動畫規格與核心狀態機規格分離。
- [ ] 「生成提案」位於圖片資訊列，緊鄰「移除」。
- [ ] `ready` 不顯示空白 result card。
- [ ] 動畫封裝在 `ProposalFlowStage` 與 `useProposalAnimation`。
- [ ] `useProposal` 不直接操作 DOM 或動畫 class。
- [ ] desktop 與 mobile 都定義 preview 目標位置。
- [ ] View Transition 不支援時仍可正常使用。
- [ ] reduced-motion 行為已定義並測試。
- [ ] 換圖、移除、retry、unmount 都會清理 active transition。
- [ ] card stack 只渲染實際收到的 proposals。
- [ ] 動畫不新增 Provider stage 或業務 state。

## 14. MVP 後再處理

- 真實 pipeline stage progress。
- SSE、WebSocket 或 polling。
- 中斷 Server request。
- 卡片拖曳、滑動手勢與物理彈簧。
- 超過三張 proposal 的分頁或虛擬化。
- 跨頁保存卡片切換位置。
