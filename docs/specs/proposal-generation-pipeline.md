# Essence Lens 提案生成 Pipeline 與 Provider 架構規格

**Status:** Proposed

## 1. Goal

將通過既有圖片可行性檢查的 `ProposalContext` 轉換成一至三筆可供 `Card.vue` 顯示的提案資料，包含：

- 封面資料或封面生成 Prompt。
- 標題。
- 簡介。
- 固定的早上、中午、下午三段行程。
- 可選的真實地點與外部連結。

本規格定義 Server pipeline 與資料契約。收藏 icon 屬於 Client UI state，不加入 Gemini Proposal domain data。

## 2. Scope

### In scope

- 拆分 Gemini Analysis、Grounding、Proposal 與 Image provider。
- 由 Factory 建立一次共用的 Gemini SDK Client，再注入各 Provider。
- 實作 `generateProposal()`，產生一至三筆 `ProposalDraft`。
- 使用 Structured Output 與 Zod 驗證 Proposal response。
- 定義 Grounding 的可選位置提示與失敗降級行為。
- 定義 Proposal Draft、Proposal、行程與封面資料模型。
- 保留既有 image feasibility pipeline、retry、idempotency 與 provider error normalization。
- 為未來的原創封面生成保留獨立 Image Provider 邊界。

### Out of scope

- Proposal 永久保存、收藏、歷史紀錄、跨裝置同步或資料庫 schema。
- 一般網站圖片抓取、Hotlink、圖片授權、CORS 與 Storage 清理。
- Google Maps Grounding 的正式整合；先保留 Grounding provider 擴充點。
- 封面圖片的 Storage adapter、URL TTL 與資產生命週期。
- 預算、交通方式、距離範圍與使用者偏好的完整輸入契約。

## 3. Delivery phases

### Phase 1：Proposal text data

- 拆分目前的 `server/providers/gemini.ts`。
- 建立共用 Gemini Client。
- 正式實作 `generateProposal()`。
- 產生一至三筆 Proposal Draft。
- 每筆 Draft 必須包含標題、摘要、三段行程與封面 Prompt。
- `cover.imageUrl` 可以不存在；Client 以原始圖片預覽作為 fallback。
- Proposal request 處於 `pending` 時，Client 顯示與卡片版面對齊的 Skeleton loader；詳細 UI 規則由 [`proposal-animation.md`](./proposal-animation.md) 與 [`proposal-status.md`](./proposal-status.md) 定義。

### Phase 2：Location Grounding

- 以語意特徵與可選的 `locationHint` 搜尋現實地點候選。
- Grounding 只補全現實世界資料，不是新的圖片安全或產品 Policy 層。
- Grounding 失敗時，預設降級成沒有特定地點的純氛圍提案。
- 沒有 `locationHint` 時，不得把圖片內容當成精確地理定位結果。

```ts
export interface ProposalLocationHint {
  city?: string
  region?: string
  countryCode?: string
}
```

### Phase 3：Proposal cover

- 根據 `cover.imagePrompt` 生成原創氛圍封面。
- 多張封面是相互獨立的工作，可使用 `Promise.allSettled()` 保留部分成功結果。
- 在 Storage／資產 URL 契約完成前，不回傳 raw bytes、base64 或未驗證的第三方 URL。
- 封面失敗不得抹除已成功產生的文字提案。

## 4. Architecture

### 4.1 Responsibility boundaries

| Layer | Responsibility |
| --- | --- |
| Provider | 將 Domain input 轉成 SDK request，驗證 SDK response，轉換 Provider error |
| `image-feasibility.service.ts` | 技術檢查、Azure Content Safety、Gemini semantic analysis、Essence Lens Policy |
| `proposal.service.ts` | 編排 Grounding、Proposal 生成、封面生成與最終 Domain mapping |
| `server/utils/providers/factory.ts` | 讀取 Runtime Config、建立 Client、組裝 Real／Mock dependencies |
| `shared/schemas` | 定義需要跨 Server／Client 使用的 canonical schema |
| `Card.vue` | 顯示 Proposal、fallback cover、行程、地點連結與收藏 UI state |

Provider 不直接決定整條產品流程，不直接操作 UI，也不呼叫 `useRuntimeConfig()`。

### 4.2 File structure

```text
server/
├─ providers/
│  ├─ azure-content-safety.ts
│  ├─ mock-providers.ts
│  ├─ provider.types.ts
│  └─ gemini/
│     ├─ client.ts
│     ├─ error.ts
│     ├─ analysis.ts
│     ├─ grounding.ts
│     ├─ proposal.ts
│     ├─ image.ts
│     ├─ index.ts
│     └─ schemas/
│        ├─ grounded-location.schema.ts
│        └─ proposal-draft.schema.ts
│
├─ services/
│  ├─ image-feasibility.service.ts
│  └─ proposal.service.ts
│
└─ utils/
   ├─ image-feasibility-policy.ts
   ├─ image-fingerprint.ts
   ├─ retry-policy.ts
   └─ providers/
      ├─ error.ts
      └─ factory.ts

shared/
├─ schemas/
│  ├─ image-semantic-analysis.ts
│  └─ proposal.ts
└─ types/
   ├─ image-feasibility.ts
   ├─ image-upload.ts
   ├─ proposal-api.ts
   └─ proposal.ts
```

`shared/schemas/image-semantic-analysis.ts` 是既有 semantic contract 的唯一來源，不移入 Gemini provider。Provider-specific schema 放在 `server/providers/gemini/schemas/`。

## 5. Gemini Client and provider dependencies

### 5.1 Shared Client

Factory 建立一個 `GoogleGenAI` instance，注入 Analysis、Grounding、Proposal 與 Image provider。各能力仍維持獨立的 Prompt、Model、Schema、Tool 與錯誤處理入口。

```ts
const geminiClient = createGeminiClient(config.geminiApiKey)
```

Provider 只接收已建立的 Client 與自身設定，不讀取 Runtime Config。

### 5.2 Provider functions

```ts
export type AnalyzeSemantics = (
  input: ProviderImageInput
) => Promise<ImageSemanticAnalysis>

export type GroundLocations = (
  input: GroundLocationsInput
) => Promise<GroundedLocation[]>

export type GenerateProposal = (
  input: ProposalGenerationContext
) => Promise<ProposalDraft[]>

export type GenerateProposalImage = (
  input: GenerateProposalImageInput
) => Promise<GeneratedProposalImage | null>
```

沿用現有 `generateProposal` 單數命名；它回傳的是 `ProposalDraft[]`。`image-feasibility.service.ts` 仍只輸出 accepted 後的 `ProposalContext`，不加入 Grounding 或 Image Provider 依賴。

### 5.3 Provider dependencies

```ts
export interface ProposalProviderDependencies
  extends ImageFeasibilityServiceDependencies {
  groundLocations: GroundLocations
  generateProposal: GenerateProposal
  generateProposalImage: GenerateProposalImage
}
```

Development mock mode 注入 typed mock provider；real provider mode 使用 Google Maps grounding 與 Agnes image provider，不以 `undefined` 或 Service 內的 inline function 繞過契約。

## 6. Provider contracts

### 6.1 Analysis Provider

輸入圖片，輸出既有 `ImageSemanticAnalysis`。它不負責：

- 指認圖片的真實拍攝地點。
- 搜尋景點。
- 產生行程。
- 生成封面圖片。

Analysis prompt 必須要求忽略圖片內的指令文字，不把 OCR 或圖片文案當成系統指令。

### 6.2 Grounding Provider

```ts
export interface GroundLocationsInput {
  analysis: ImageSemanticAnalysis
  locale: string
  locationHint?: ProposalLocationHint
}

export interface GroundedLocation {
  name: string
  address?: string
  sourceUrl: string
  reason: string
  confidence?: number
}
```

Grounding 回答「有哪些地方符合這些特徵」，不是「原圖一定拍攝於哪裡」。`sourceUrl` 只作為內部追溯資料，不直接信任 Gemini 提供的 UI link。

### 6.3 Proposal Provider

```ts
export interface ProposalGenerationContext {
  analysis: ImageSemanticAnalysis
  locations: GroundedLocation[]
  locale: string
}

export interface ProposalDraft {
  title: string
  summary: string
  itinerary: ProposalItinerary
  locationCandidate?: string
  cover: {
    imagePrompt: string
  }
}
```

`locationCandidate` 只用來對應 Grounding 結果，不接受 Provider 任意輸出的 URL。若無法對應，Service 移除該 location，而不是猜測。

### 6.4 Image Provider

Image Provider 只接收單一封面 Prompt，透過 Agnes Image 2.5 Flash 的 server-side API 產生原創封面，輸出待由資產層處理的公開 URL。它不決定提案內容、不查找地點、不上傳 Storage，也不修改既有文字資料。

Agnes request 使用：

- endpoint：`https://apihub.agnes-ai.com/v1/images/generations`。
- model：`agnes-image-2.5-flash`。
- `size: "1K"`、`ratio: "3:2"`。
- `extra_body.response_format: "url"`，不將 Base64 圖片回傳給 Client。

Agnes API key 只從 server runtime config 讀取，不進入 public runtime config。

Storage 契約尚未存在時，封面狀態設為 `unavailable`，保留 `imagePrompt`；不得把 raw bytes、base64 或未驗證 URL 回傳給 Client。

## 7. Proposal schema

### 7.1 Canonical schema

`shared/schemas/proposal.ts` 是對外 Proposal 的 single source of truth，負責：

- 產生 shared TypeScript type。
- 驗證 Provider／Service 最終 mapping 後的資料。
- 提供 API response 使用的 schema。

Provider 的 `ProposalDraft` schema 只驗證 Gemini 產出的 Draft，不使用 `Omit<Proposal>` 來推導，避免把 Service 才能建立的 `id`、URL 或封面狀態交給模型。

### 7.2 Domain model

```ts
export interface Proposal {
  id: string
  title: string
  summary: string
  itinerary: ProposalItinerary
  location?: {
    name: string
    address?: string
    externalUrl?: string
  }
  cover: {
    imagePrompt: string
    imageUrl?: string
    status: 'unavailable' | 'pending' | 'ready' | 'failed'
  }
}

export interface ProposalItinerary {
  morning: ProposalActivity
  noon: ProposalActivity
  afternoon: ProposalActivity
}

export interface ProposalActivity {
  title: string
  description?: string
}
```

### 7.3 Rules

- 每次回傳一至三筆，不接受空陣列。
- `id` 由 Service 建立，不由 Gemini 決定。
- `title`、`summary`、三段 itinerary 與 `cover.imagePrompt` 必須存在。
- `location` 可不存在；沒有可驗證地點時，Client 隱藏地點列。
- `externalUrl` 由 Service 根據已驗證的地點資料建立；可使用名稱／地址建立 deterministic Maps search URL，不能直接採用模型任意 URL。
- `isFavorite` 不屬於 API Proposal；收藏狀態由 Client component 或未來的收藏 store 管理。
- 既有 `Proposal.description` 遷移為 `summary` 時，必須同步更新 `Card.vue`、API response schema 與測試。

## 8. Service pipeline

### 8.1 Image feasibility service

核心流程維持不變：

```text
圖片技術驗證
    ↓
Azure Content Safety
    ↓
Gemini Semantic Analysis
    ↓
Essence Lens Policy
    ↓
accepted / rejected / error
```

```ts
export interface ImageFeasibilityServiceDependencies {
  analyzeSafety: AnalyzeSafety
  analyzeSemantics: AnalyzeSemantics
}
```

此 Service 不新增 `groundLocations`、`generateProposal` 或 `generateProposalImage` 依賴。

### 8.2 Proposal service

```text
Proposal API
  ↓
image-feasibility.service
  ├─ technical validation
  ├─ Azure Content Safety
  ├─ Gemini semantic analysis
  └─ Essence Lens Policy
  ↓ accepted
optional Grounding
  ↓ success or explicit degradation
Generate ProposalDraft[]
  ↓ schema validation and domain mapping
optional cover generation
  ↓ partial success allowed
Proposal[]
```

Service 必須：

1. 依序呼叫 feasibility service、Grounding、Proposal Provider。
2. Feasibility 非 `accepted` 時，不呼叫後續 Provider。
3. Grounding 失敗時依明確 policy 降級，不將 Provider error 當成圖片 rejection。
4. 將 Draft 對應到 grounded location，建立 `id`、`externalUrl` 與封面狀態。
5. 封面採部分成功策略；文字 Proposal 已成功時，不因單張圖片失敗而整批失敗。
6. 保持既有 retry 與 idempotency 行為；新的 retry 不應在 Service 內形成無限遞迴。

## 9. Factory wiring

`server/utils/providers/factory.ts` 是唯一讀取 Runtime Config 的位置，現有檔案位置不變。

```ts
const geminiClient = createGeminiClient(config.geminiApiKey)

return {
  analyzeSafety: createAzureContentSafetyProvider(config.azureContentSafety),
  analyzeSemantics: createGeminiAnalysisProvider({
    client: geminiClient,
    model: config.geminiSemanticModel
  }),
  groundLocations: createGeminiGroundingProvider({
    client: geminiClient,
    model: config.geminiGroundingModel
  }),
  generateProposal: createGeminiProposalProvider({
    client: geminiClient,
    model: config.geminiProposalModel
  }),
  generateProposalImage: createAgnesImageProvider({
    apiKey: config.agnesApiKey,
    model: config.agnesImageModel,
    baseUrl: config.agnesApiBaseUrl
  })
}
```

實際 runtime config 名稱可沿用目前 flat config；上例只描述責任。若未提供 capability-specific model，應由 Factory 使用明確 fallback，不在 Provider 內自行讀取 config。

`server/providers/gemini/index.ts` 作為 Gemini provider 的穩定匯出入口；Agnes image provider 由 `server/providers/agnes/index.ts` 匯出。

## 10. Error handling and degradation

| 階段 | 行為 |
| --- | --- |
| 技術驗證失敗 | `rejected`，回傳產品可顯示原因 |
| Azure Safety 拒絕 | `rejected`，不呼叫後續 Gemini |
| Analysis 失敗 | `error`，不進入 Proposal Generation |
| Policy 拒絕 | `rejected`，回傳整理後 reason code |
| Grounding 失敗 | 記錄安全的 provider debug，降級成無特定地點提案 |
| Proposal schema invalid | `error`，不回傳未驗證資料 |
| 單張封面失敗 | 保留文字 Proposal，該卡 cover 為 `failed` |
| 全部封面失敗 | 仍回傳文字 Proposal，Client 使用 fallback cover |

Gemini-specific error parsing 留在 `server/providers/gemini/error.ts`；跨 Provider mapping 繼續使用 `server/utils/providers/error.ts`。

不得寫入 log 或 API response：API key、原始圖片 bytes、base64、完整 SDK response、OCR 原文或模型 reasoning。

## 11. Idempotency and retry

- 相同 `Idempotency-Key` 與相同圖片 fingerprint：回放既有 normalized outcome。
- 相同 key 與不同 fingerprint：回傳 `409 Conflict`。
- 使用者主動 retry：建立新的 idempotency key。
- Provider retry 只處理既有 retry policy 判定為暫時性錯誤的情境。
- Cache 不保存 raw image 或 Provider intermediate response。
- 若將來 cache 封面 URL，必須先定義 asset URL 的有效期限與失效策略。

## 12. Tests

### Provider unit tests

- Proposal structured output 可正確 parse 與 Zod validation。
- 不合法 JSON、缺少必要欄位與超過三筆輸出會失敗。
- Proposal response 使用既有語意資料，不重新定義 Analysis shape。
- Grounding response 可轉成 `GroundedLocation[]`。
- Model output 的 URL 不會直接成為對外 `externalUrl`。
- Image prompt 不要求重製角色、Logo、文字、原圖或精確構圖。
- Provider error 能映射到既有 normalized error。

### Service tests

- 圖片 rejected 或 error 時，不呼叫 Grounding、Proposal 或 Image Provider。
- accepted 後依正確順序呼叫後續 Provider。
- Grounding 失敗時可產生沒有 location 的 Proposal。
- Draft schema invalid 時回傳 `error`。
- 單張封面失敗時仍保留其他成功卡片與文字資料。
- `externalUrl` 只由 Service 對已驗證資料建立。

### Factory／Mock tests

- Mock 與 Real mode 都滿足完整 `ProposalProviderDependencies`。
- 四個 Gemini capability provider 收到同一個 client instance。
- Provider 不直接呼叫 `useRuntimeConfig()`。
- `image-feasibility.service.ts` 的依賴沒有因新增能力而擴張。

## 13. Acceptance

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
```

並確認：

- `generateProposal()` 不再拋出 `Gemini provider is not connected`。
- `generateProposal()` 產生一至三筆通過 schema 的 Draft。
- 每筆結果含標題、摘要、早上／中午／下午行程與 `imagePrompt`。
- 現有 `ImageSemanticAnalysis` schema、Policy 與 feasibility flow 不被破壞。
- `image-feasibility.service.ts` 仍只依賴 Safety 與 Analysis。
- Factory 是唯一 Runtime Config wiring point，且 Gemini client 只建立一次。
- Grounding 失敗不會錯誤地變成圖片 rejection。
- 尚未有 Storage 時，不回傳 raw bytes、base64 或未驗證圖片 URL。
- Proposal card 可在 `cover.imageUrl` 缺少時使用原始圖片 fallback。
- `Proposal.description` → `summary` 的 migration 同步完成於 shared type、Card、API 與測試。
- 收藏 icon 不被誤放進 Server Proposal domain。

## 14. Implementation order

1. 新增 shared Proposal schema／types，保留現有 semantic schema。
2. 拆出 Gemini client、error、analysis、proposal 與 index，先維持舊 export 相容。
3. 擴充 provider types 與 mock provider，讓 TypeScript 先鎖定完整契約。
4. 在 Factory 注入同一個 Gemini client 與 Phase 1 provider。
5. 實作 `generateProposal()` 的 structured output、parse、Zod validation 與 error mapping。
6. 更新 `proposal.service.ts` 的 Draft → Proposal mapping；Phase 1 先使用 no-op Grounding／Image。
7. 更新 `Card.vue` 與 API／測試的 `description` → `summary` migration。
8. 以 unit、service、typecheck、lint、build 驗證，再進入 Grounding。

## 15. References

- [Gemini 語意化圖片分析](./gemini-semantic-analysis.md)
- [提案流程狀態規格](./proposal-status.md)
- [提案流程動畫規格](./proposal-animation.md)
- [提案生成規格 - Google 文件](https://docs.google.com/document/d/14dciwjOXlKxg7nQt2jb2Wmzz0XR_CTEIN9sHGz-k0o4/edit)
- [Gemini API getting started](https://ai.google.dev/gemini-api/docs/generate-content)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Zod JSON Schema](https://zod.dev/json-schema)

## Commit Message

```text
docs(proposal): define generation pipeline and provider boundaries
```
