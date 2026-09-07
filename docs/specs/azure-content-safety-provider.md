# Azure Content Safety Provider 規格

## 目標

在 Server provider layer 實作 Azure AI Content Safety 圖片分析，將 Azure SDK response 轉換成專案既有的 `ContentSafetyAssessment`，不改變前端 Proposal API contract。

## 範圍

- 支援 Azure Image Analysis API。
- 使用官方 `@azure-rest/ai-content-safety` 與 `@azure/core-auth`。
- 使用 API Key 與 private Nuxt runtime config。
- 保留每個安全分類的 `severity`：`0 | 2 | 4 | 6`。
- 不在前端直接呼叫 Azure。
- 不將 Azure 原始錯誤或 response payload 傳給 Client。

## 資料流

```text
Client File
  ↓ multipart/form-data
/api/proposal
  ↓ ProviderImageInput { bytes, mimeType, filename }
proposal.service
  ↓
image-feasibility.service
  ↓ analyzeSafety
azure-content-safety provider
  ↓ Base64 image content
Azure Image Analysis API
```

## Provider 輸入

Provider 接收既有的 `ProviderImageInput`：

```ts
interface ProviderImageInput {
  bytes: Uint8Array
  mimeType: string
  filename: string
}
```

不使用檔案路徑。`bytes` 應在 Server 端轉成 Base64：

```ts
Buffer.from(input.bytes).toString('base64')
```

範例中的 `fs.readFileSync()`、`path` 與 `dotenv` 僅適用於獨立 Node.js 腳本，不應搬入 Nuxt provider。

## Response 映射

Azure 回傳的 `categoriesAnalysis` 每筆資料包含 `category` 與 `severity`：

| Azure category | 內部 category | 內部 severity       |
| -------------- | ------------- | ------------------- |
| `Hate`         | `hate`        | 保留 Azure severity |
| `SelfHarm`     | `self-harm`   | 保留 Azure severity |
| `Sexual`       | `sexual`      | 保留 Azure severity |
| `Violence`     | `violence`    | 保留 Azure severity |

標準化結果：

```ts
interface ContentSafetyAssessment {
  provider: 'azure-content-safety'
  categories: {
    hate: 0 | 2 | 4 | 6
    'self-harm': 0 | 2 | 4 | 6
    sexual: 0 | 2 | 4 | 6
    violence: 0 | 2 | 4 | 6
  }
}
```

若 Azure response 缺少某個 category，該 category 預設為 `0`。若 category 或 severity 不符合預期，視為 malformed provider response，不可默認為安全。

## 錯誤處理

1. Provider 使用 `isUnexpected(result)` 判斷 SDK response 是否為非成功結果。
2. Provider 不回傳原始 SDK response，也不暴露 API Key；只保留 HTTP status 與 Azure `error.code`。
3. `image-feasibility.service.ts` 沿用既有 `withRetry`，並將 provider error 分類為 configuration、authentication、invalid request、transient 或 malformed response。
4. development 可透過 API diagnostics 與 Server console 查看 provider、status code 與 provider code；production 不輸出 console，也不回傳 diagnostics。
5. `useProposal.ts` 只接收 API 層的穩定錯誤碼，不處理 Azure SDK 細節。

## Runtime config

保留既有 private runtime config：

```ts
runtimeConfig: {
  proposalProviderMode: 'mock',
  azureContentSafetyEndpoint: '',
  azureContentSafetyApiKey: ''
}
```

本機 `.env`：

```env
NUXT_AZURE_CONTENT_SAFETY_ENDPOINT=https://essence-lens-content-safety.cognitiveservices.azure.com/
NUXT_AZURE_CONTENT_SAFETY_API_KEY=
NUXT_PROPOSAL_PROVIDER_MODE=mock
```

API Key 不可放入 `runtimeConfig.public`，也不可提交真實 `.env`。

## 開發環境行為

目前 development mode 預設使用 mock providers。設定 `NUXT_PROPOSAL_PROVIDER_MODE=azure` 後，才允許 `/api/proposal` 在本機使用真實 provider；此模式會同時使用 Azure 與 Gemini provider。

安全分析先於 Gemini 執行：

```text
Azure severity > 0
  → 回傳 rejected
  → 建立 safety rejection reason
  → 不呼叫 Gemini semantic analysis
  → 不呼叫 proposal generation
```

若 Azure 四個 category 的 severity 都是 `0`，流程才會進入 Gemini。由於 Gemini provider 目前尚未完成，安全通過的完整 proposal flow 仍可能在後續失敗；這不影響驗證 Azure 安全拒絕短路行為。

## 需要調整的檔案

- `server/providers/azure-content-safety.ts`：建立 SDK client、Base64 轉換、response mapping 與 provider error boundary。
- `server/utils/providers/error.ts`：正規化 provider status、error code 與重試分類。
- `server/utils/providers/factory.ts`：依 runtime mode 組合 mock 或真實 provider。
- `server/services/image-feasibility.service.ts`：將 provider error 轉為穩定錯誤碼與安全 diagnostics。
- `server/api/proposal.post.ts`：依 `NUXT_PROPOSAL_PROVIDER_MODE` 選擇 mock 或真實 provider，development 預設仍使用 mock。
- `.env.example`：加入不含秘密的環境變數範例。
- `tests/unit/azure-content-safety.test.ts`：測試 request payload、四類 category、severity、缺少欄位與錯誤 response。

以下檔案初次整合不需修改：

- `app/composables/useProposal.ts`
- `server/services/proposal.service.ts`
- `server/services/image-feasibility.service.ts`
- `shared/types/image-feasibility.ts`

## 驗收條件

- Azure 四個 category 都能正確映射。
- 每個 category 的 `severity` 都保留。
- `Hate: 0` 等安全結果會產生全為 `0` 的標準化資料。
- Provider 使用 `ProviderImageInput.bytes`，不依賴檔案路徑。
- API Key 僅存在 Server private runtime config。
- Azure 原始錯誤與 payload 不會傳到前端；development 僅提供安全的 provider、status code 與 provider code diagnostics。
- 既有 unit、Nuxt、lint 與 typecheck 通過。
