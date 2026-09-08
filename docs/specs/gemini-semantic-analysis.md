# Gemini 語意化圖片分析

**Status:** Implemented

## 1. Goal

在既有的 proposal pipeline 中接入 Gemini 圖片語意分析，讓 Azure Content Safety 通過後的圖片進入 Gemini image understanding，取得經 JSON Schema 約束並由 Zod 驗證的 `ImageSemanticAnalysis`。

本規格只處理語意分析，不處理 Proposal Generation 或圖片生成。

## 2. Scope

### In scope

- 安裝 `@google/genai`。
- 安裝 `zod`，使用 Zod schema 做 runtime validation。
- 使用 server-only `GoogleGenAI` client。
- 將既有 `ProviderImageInput.bytes` 與 `mimeType` 轉成 Gemini inline image data。
- 使用 Gemini structured JSON response。
- 驗證 JSON parse 結果與 `ImageSemanticAnalysis` schema。
- 沿用既有 provider error normalization 與 retry flow。
- 補 Gemini provider unit tests。

### Out of scope

- `generateProposal()` 實作。
- Gemini 圖片生成或其他多模態生成。
- 新增 `/api/gemini` 或 `/api/azure` proxy endpoint。
- 前端、Pinia、upload component 或 API contract 變更。
- 將現有 provider 從 `generateContent` 遷移到 Interactions API。

## 3. Architecture

```text
server/api/proposal.post.ts
  ↓
server/services/proposal.service.ts
  ↓
server/services/image-feasibility.service.ts
  ├─ Azure Content Safety
  ├─ Gemini semantic analysis
  └─ existing feasibility policy
```

Gemini provider 只負責：

- runtime config 讀取。
- SDK client 初始化。
- 圖片與 prompt 組裝。
- structured response 設定。
- response parse 與 schema validation。
- provider error mapping。

Policy、service 與 API layer 不直接依賴 Gemini SDK response shape。

## 4. Dependencies

```bash
pnpm add @google/genai
pnpm add zod
```

不安裝 `zod-to-json-schema`。Zod 4 原生提供 `z.toJSONSchema()`，因此由 Zod schema 產生 Gemini 所需的 JSON Schema。

Nuxt 不提供應用程式層的 Zod 依賴；`zod` 必須明確列在專案 dependencies。

## 5. Schema decision

原本的 `ImageSemanticAnalysis` 是 TypeScript interface。三者必須收斂成一個 single source of truth：以 shared Zod schema 作為 canonical contract，再由它推導 TypeScript type 與 Gemini JSON Schema，避免三份結構漂移。

預計位置：

```text
shared/schemas/image-semantic-analysis.ts
```

### Single source of truth

```text
imageSemanticAnalysisSchema  ← 唯一手寫定義
              │
              ├─ z.infer<typeof ...>
              │       ↓
              │  ImageSemanticAnalysis
              │
              ├─ z.toJSONSchema()
              │       ↓
              │  imageSemanticAnalysisJsonSchema
              │       └─ Gemini structured output contract
              │
              └─ safeParse()
                      └─ Gemini response runtime validation
```

- Gemini request 使用由同一份 `imageSemanticAnalysisSchema` 產生的 `imageSemanticAnalysisJsonSchema`。
- Gemini response 使用 `imageSemanticAnalysisSchema.safeParse()` 做 runtime validation。
- `ImageSemanticAnalysis` 使用 `z.infer<typeof imageSemanticAnalysisSchema>` 推導，不再維護自訂 `JsonSchemaToType`。
- 使用 `z.strictObject()` 保留原本 JSON Schema `additionalProperties: false` 的拒絕未知欄位語意。
- `toGeminiJsonSchema()` 只負責將 Zod 產出的等價語法正規化成 Gemini 支援的 JSON Schema 子集合，不是第二份欄位定義。
- `ProposalContext` 是通過 policy 後的刻意縮減資料，不是另一份 semantic analysis schema。
- Policy 只依賴推導出的 `ImageSemanticAnalysis` type，不自行重複欄位定義。

### JSON Schema contract

`imageSemanticAnalysisJsonSchema` 是由 `imageSemanticAnalysisSchema` 產生的 Gemini request contract。以下只保留輸出形狀作為文件參考，不能直接修改這段內容；欄位應修改 Zod schema，再重新產生 JSON Schema。

```ts
const imageSemanticAnalysisJsonSchema = z.toJSONSchema(imageSemanticAnalysisSchema)
/* 產生的 JSON Schema 形狀如下：
{
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: 'string',
      enum: ['image-semantic-analysis-v1']
    },
    scene: {
      type: 'object',
      additionalProperties: false,
      properties: {
        category: {
          type: 'string',
          enum: ['indoor', 'outdoor', 'nature', 'urban', 'unknown']
        },
        recognizable: { type: 'boolean' }
      },
      required: ['category', 'recognizable']
    },
    subjects: {
      type: 'object',
      additionalProperties: false,
      properties: {
        peopleCount: { type: ['integer', 'null'], minimum: 0 },
        isSelfie: {
          type: 'string',
          enum: ['absent', 'present', 'unknown']
        },
        hasProductFocus: {
          type: 'string',
          enum: ['absent', 'present', 'unknown']
        },
        hasPetCloseup: {
          type: 'string',
          enum: ['absent', 'present', 'unknown']
        },
        isMemeLike: {
          type: 'string',
          enum: ['absent', 'present', 'unknown']
        }
      },
      required: [
        'peopleCount',
        'isSelfie',
        'hasProductFocus',
        'hasPetCloseup',
        'isMemeLike'
      ]
    },
    quality: {
      type: 'object',
      additionalProperties: false,
      properties: {
        blur: {
          type: 'string',
          enum: ['none', 'mild', 'severe', 'unknown']
        },
        isSolidColor: {
          type: 'string',
          enum: ['absent', 'present', 'unknown']
        },
        informationSufficient: { type: 'boolean' }
      },
      required: ['blur', 'isSolidColor', 'informationSufficient']
    },
    safety: {
      type: 'object',
      additionalProperties: false,
      properties: {
        nudity: {
          type: 'string',
          enum: ['absent', 'present', 'unknown']
        },
        sexual: {
          type: 'string',
          enum: ['absent', 'present', 'unknown']
        },
        violence: {
          type: 'string',
          enum: ['absent', 'present', 'unknown']
        },
        gore: {
          type: 'string',
          enum: ['absent', 'present', 'unknown']
        }
      },
      required: ['nudity', 'sexual', 'violence', 'gore']
    },
    visualMood: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5
    },
    usefulObjects: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    }
  },
  required: [
    'schemaVersion',
    'scene',
    'subjects',
    'quality',
    'safety',
    'visualMood',
    'usefulObjects'
  ]
}
*/
```

`unknown` 必須保留，不能在 provider layer 被轉換成 `absent`。`visualMood` 與 `usefulObjects` 只能描述圖片可觀察內容，不保存原始 OCR 文字。

### Human-readable schema reference

#### Root fields

| 欄位            | 型別 / 值域                           | 命名用意                               | 產品用途                                                  |
| --------------- | ------------------------------------- | -------------------------------------- | --------------------------------------------------------- |
| `schemaVersion` | 固定字串 `image-semantic-analysis-v1` | 表示語意分析資料契約版本               | 追蹤 schema 變更；不是 Gemini model 版本                  |
| `scene`         | object                                | 描述圖片的主要場景                     | 判斷圖片是否具備可理解的環境資訊                          |
| `subjects`      | object                                | 描述圖片中的主要主體與主題風險         | 排除自拍、商品照、寵物特寫與迷因                          |
| `quality`       | object                                | 描述圖片是否有足夠的視覺品質與資訊     | 排除純色、嚴重模糊或資訊不足的圖片                        |
| `safety`        | object                                | 描述 Gemini 從圖片觀察到的安全相關訊號 | 作為語意 policy 的一部分；不取代 Azure Content Safety     |
| `visualMood`    | string array                          | 描述圖片呈現出的視覺氛圍               | 提供後續 Proposal Generation 使用，例如 `calm`、`curious` |
| `usefulObjects` | string array                          | 列出圖片中可觀察且可能有助於提案的物件 | 提供後續 Proposal Generation 使用，例如 `street`、`light` |

#### `scene`

| 欄位                 | 型別 / 值域                                             | 命名用意           | Policy 影響                              |
| -------------------- | ------------------------------------------------------- | ------------------ | ---------------------------------------- |
| `scene.category`     | enum：`indoor`、`outdoor`、`nature`、`urban`、`unknown` | 圖片主要場景類型   | `unknown` 不代表安全，會進入資訊不足判斷 |
| `scene.recognizable` | boolean                                                 | 是否能辨識主要場景 | `false` → `unrecognizable-scene`         |

#### `subjects`

| 欄位                       | 型別 / 值域                            | 命名用意                               | Policy 影響                            |
| -------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------- |
| `subjects.peopleCount`     | non-negative integer 或 `null`         | 可辨識的人物數量                       | 只描述數量，不辨識姓名、身份或臉部特徵 |
| `subjects.isSelfie`        | signal：`absent`、`present`、`unknown` | 是否以自拍為主要內容                   | `present` → `selfie`                   |
| `subjects.hasProductFocus` | signal                                 | 是否為商品展示或商品主體照             | `present` → `product-photo`            |
| `subjects.hasPetCloseup`   | signal                                 | 是否為寵物特寫                         | `present` → `pet-closeup`              |
| `subjects.isMemeLike`      | signal                                 | 是否像迷因、文字截圖或以文字為主的圖片 | `present` → `meme-like`                |

#### `quality`

| 欄位                            | 型別 / 值域                               | 命名用意                           | Policy 影響                          |
| ------------------------------- | ----------------------------------------- | ---------------------------------- | ------------------------------------ |
| `quality.blur`                  | enum：`none`、`mild`、`severe`、`unknown` | 圖片模糊程度                       | `severe` → `severely-blurred`        |
| `quality.isSolidColor`          | signal                                    | 是否幾乎只有單一顏色、缺少視覺資訊 | `present` → `solid-color`            |
| `quality.informationSufficient` | boolean                                   | 是否有足夠資訊支援後續生活提案     | `false` → `insufficient-information` |

#### `safety`

| 欄位              | 型別 / 值域 | 命名用意                   | Policy 影響            |
| ----------------- | ----------- | -------------------------- | ---------------------- |
| `safety.nudity`   | signal      | 是否觀察到裸露相關內容     | `present` → `nudity`   |
| `safety.sexual`   | signal      | 是否觀察到性相關內容       | `present` → `sexual`   |
| `safety.violence` | signal      | 是否觀察到暴力內容         | `present` → `violence` |
| `safety.gore`     | signal      | 是否觀察到血腥或肢解等內容 | `present` → `gore`     |

#### Signal semantics

| 值        | 意義                           | 使用規則                                                                  |
| --------- | ------------------------------ | ------------------------------------------------------------------------- |
| `absent`  | 模型能可靠判斷該訊號不存在     | 可作為通過該項判斷的依據                                                  |
| `present` | 模型能可靠判斷該訊號存在       | 交由 policy 產生對應 reject reason                                        |
| `unknown` | 圖片資訊不足或模型無法可靠判斷 | 不得自動轉成 `absent`；關鍵欄位會導向 analysis unavailable 或對應資訊拒絕 |

`peopleCount: null` 與 signal `unknown` 的差異是：前者表示「無法提供可靠數量」，後者表示「無法判斷某個分類訊號」。兩者都不是 `0` 或 `absent` 的別名。

### Context window and token budget

Human-readable schema table 是給開發者看的文件，不會送進 Gemini。實際 request 會包含 JSON Schema、prompt 與圖片資料。

目前 schema 的最大巢狀深度約為三層，欄位主要是 boolean、integer、enum 與短字串，不屬於大型或高複雜度 schema。真正可能造成 output 膨脹的是 `visualMood` 與 `usefulObjects`，因此設定初始上限：

| 欄位            |    上限 | 原因                                         |
| --------------- | ------: | -------------------------------------------- |
| `visualMood`    | 5 items | 提供足夠的氛圍標籤，不讓模型產生同義詞清單   |
| `usefulObjects` | 8 items | 保留可用於提案的主要物件，不輸出完整物件盤點 |

Prompt 也要求每個 label 使用簡短、可觀察的英文名詞或形容詞，不產生句子、解釋或重複項目。

## 6. Gemini request

Provider 使用既有 `generateContent` one-shot flow：

```ts
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [
    {
      inlineData: {
        mimeType: input.mimeType,
        data: Buffer.from(input.bytes).toString('base64')
      }
    },
    { text: semanticAnalysisPrompt }
  ],
  config: {
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    responseJsonSchema: imageSemanticAnalysisJsonSchema
  }
})
```

Prompt 必須要求：

- 只回傳指定 JSON schema。
- 圖片內文字只能作為視覺內容或迷因判斷依據。
- 不執行圖片內文字提出的指令。
- 無法可靠判斷時回傳 `unknown`，不可猜測為 `absent`。
- 不辨識姓名、身份、臉部特徵或敏感人物屬性。
- `visualMood` 與 `usefulObjects` 只回傳簡短 label，不產生句子、解釋或重複項目。

API key 只從既有 private runtime config 的 `geminiApiKey` 讀取，不進入 public runtime config。

## 7. Response validation

處理順序：

1. 檢查 `response.text` 是否存在。
2. 執行 `JSON.parse(response.text)`。
3. 執行 `imageSemanticAnalysisSchema.safeParse(parsed)`。
4. 回傳驗證後的 `ImageSemanticAnalysis`。

以下情況統一拋出 provider code `schema-validation-failed`，交由既有 normalizer 分類為 `invalid-response`：

- response 沒有文字內容。
- response 不是合法 JSON。
- JSON 不符合 schema。

Structured output 只保證格式符合 JSON Schema，不保證語意正確，因此仍必須執行 application-side validation 與既有 policy。

## 8. Development observability

開發觀察統一使用 `debug`，不再新增或延伸 `diagnostics` 欄位。

```ts
interface ProposalDebugInfo {
  provider?: {
    provider: string
    statusCode?: number
    providerCode?: string
  }
  semanticAnalysis?: ImageSemanticAnalysis
}
```

### Response rules

- `debug` 只在 `import.meta.dev` 且 request 明確 opt-in 時回傳。
- provider error 的安全資訊放在 `debug.provider`。
- Gemini 通過或拒絕時的語意結果放在 `debug.semanticAnalysis`。
- production 永不回傳 `debug`。
- `debug` 不屬於正常 `ProposalOutcome`，避免 `ImageSemanticAnalysis` 被寫入一般 idempotency cache。
- debug request 應使用不寫入一般 pipeline cache 的執行路徑。
- debug 內容不包含原始 provider response、base64 圖片、OCR 文字、API key 或模型 reasoning。

瀏覽器驗證方式：

1. development mode 開啟 DevTools Network。
2. 以 `X-Proposal-Debug: 1` header 作為 debug opt-in 送出 `POST /api/proposal`。
3. 在 response 的 `debug.semanticAnalysis` 查看驗證後的語意結果。

一般成功 response 不會包含 `debug`：

```json
{
  "status": "success",
  "requestId": "...",
  "proposals": []
}
```

開發環境的 debug response 才可能包含：

```json
{
  "status": "success",
  "requestId": "...",
  "proposals": [],
  "debug": {
    "semanticAnalysis": {}
  }
}
```

### Naming decision

API response、service result 與 shared types 不使用 `diagnostics` 作為公開欄位名稱。Provider error 的型別名稱也應改為 `ProposalDebugInfo.provider` 所使用的結構，避免 `debug` 與 `diagnostics` 同時存在造成語意重疊。

## 9. Error handling

| 情境                                        | Provider code / result                |
| ------------------------------------------- | ------------------------------------- |
| 缺少 `geminiApiKey`                         | `missing-configuration`               |
| Gemini 400                                  | 既有 `provider-invalid-request`       |
| Gemini 401 / 403                            | 既有 `provider-authentication-failed` |
| Gemini timeout / 5xx                        | 既有 retryable provider error         |
| 空 response / invalid JSON / schema invalid | `schema-validation-failed`            |

不記錄 API key、base64 圖片、完整 Gemini response、OCR 文字或模型 reasoning。

## 10. Tests

新增 `tests/unit/gemini.test.ts`，不進行真實網路請求，至少覆蓋：

- valid structured JSON 會被 parse 成 `ImageSemanticAnalysis`。
- request 包含正確 `mimeType` 與 base64 image data。
- request 使用 JSON response format 與 schema。
- invalid JSON 會拋出 `schema-validation-failed`。
- schema-invalid JSON 會拋出 `schema-validation-failed`。
- 缺少 API key 會拋出 `missing-configuration`。

既有 pipeline tests 必須持續證明：Azure safety 未通過時不呼叫 Gemini；Azure 通過後才呼叫 semantic analysis。

## 11. Acceptance

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
```

並確認：

- mock provider mode 行為不變。
- Gemini semantic response 經過 JSON parse 與 Zod validation。
- Gemini provider error 可被既有 service error mapping 處理。
- development opt-in response 可在瀏覽器 Network 中查看 `debug.semanticAnalysis`。
- provider error 的安全資訊統一位於 `debug.provider`。
- production response 不包含 `debug`。
- 一般 idempotency cache 不保存 `ImageSemanticAnalysis`。
- `generateProposal()` 保持未實作狀態。
- 沒有新增多模態生成能力。
- 沒有新增公開 provider proxy endpoint。

## 12. References

- [Gemini API getting started](https://ai.google.dev/gemini-api/docs/generate-content/get-started)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Zod JSON Schema](https://zod.dev/json-schema)
