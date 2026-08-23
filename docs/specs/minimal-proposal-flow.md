# 最小提案流程：元件與樣式規格

## 目標

完成一個最小可驗收的資料流程：

使用者點擊「產生提案」後，Client 透過 `$fetch` 呼叫
`POST /api/proposal`，取得固定的 Mock Data，最後顯示在畫面上。

本階段只處理資料能從 Server 回到 Client，暫不加入圖片分析、Gemini API
或資料庫。

## 元件結構

```txt
app/
├─ pages/
│  └─ index.vue
├─ components/
│  └─ proposal/
│     ├─ ProposalIntro.vue
│     ├─ GenerateProposalButton.vue
│     └─ ProposalResultPanel.vue
└─ composables/
   └─ useProposal.ts

server/
└─ api/
   └─ proposal.post.ts

shared/
└─ types/
   └─ proposal.ts
```

## 元件責任

### `pages/index.vue`

負責組合頁面與管理資料流程。

- 使用 `useProposal`
- 接收按鈕事件
- 傳遞 loading、error、proposal 狀態
- 不直接處理畫面細節

### `ProposalIntro.vue`

負責顯示頁面標題與說明文字。

不處理 API，也不管理狀態。

### `GenerateProposalButton.vue`

負責顯示「產生提案」按鈕。

- 接收 `loading` prop
- loading 時停用按鈕
- 透過 `generate` event 通知頁面開始請求

### `ProposalResultPanel.vue`

負責顯示結果區域的不同狀態：

- 初始狀態：尚未產生提案
- 載入狀態：正在產生提案
- 成功狀態：顯示標題與說明
- 錯誤狀態：顯示簡短錯誤訊息

這些狀態先集中在同一個元件，不另外拆出四個小元件。

## 資料格式

```typescript
export interface Proposal {
  title: string
  description: string
}

export type ProposalStatus = 'idle' | 'loading' | 'success' | 'error'
```

Mock Data：

```typescript
{
  title: '午後散步與咖啡',
  description: '到附近街區散步，再找一間安靜的咖啡店休息。'
}
```

## 資料流程

```text
點擊按鈕
  ↓
index.vue 呼叫 useProposal.generate()
  ↓
$fetch('/api/proposal', { method: 'POST' })
  ↓
server/api/proposal.post.ts 回傳 Mock Data
  ↓
useProposal 更新 proposal 與 status
  ↓
ProposalResultPanel 顯示結果
```

## Tailwind 樣式方向

畫面採用安靜、偏 editorial 的週末提案工具風格，不使用常見的 AI 紫色漸層或儀表板配置。

### 色彩

```text
背景：#F3F5F2
主要文字：#202622
次要文字：#68726B
邊框：#D8DED8
主要操作色：#F1BF82/ Hover：#E4774E
```

### 版面

- 桌面版使用左右分欄。
- 左側放標題、說明與操作按鈕。
- 右側放提案結果區域。
- 手機版改為單欄排列。
- 使用 Tailwind utility classes，不在元件內新增一般 CSS。

### 元件視覺

- 頁面使用淡灰綠背景。
- 結果區域使用白色或半透明白色面板。
- 面板使用細邊框與適度圓角。
- 按鈕使用暖橘色，hover 與 active 只做輕微變化。
- 不加入圖片、標籤、信心分數或裝飾性動畫。

## 驗收條件

- 初始畫面不顯示 Mock Data。
- 點擊按鈕後，送出 `POST /api/proposal`。
- API 回應 HTTP 200。
- Response 符合 `Proposal` 型別。
- 畫面顯示正確的標題與說明。
- loading 時按鈕不可重複送出。
- API 失敗時顯示錯誤狀態。
- 桌面與手機版都能正常閱讀。
- Console 沒有錯誤。

## 本階段不處理

- 圖片上傳與圖片分析
- Gemini API
- runtime config
- 資料庫
- 使用者登入
- 完整視覺切版
- 提案收藏與歷史紀錄
