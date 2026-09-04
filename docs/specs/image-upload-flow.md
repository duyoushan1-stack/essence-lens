# 圖片上傳流程：選取、驗證與預覽規格

## Design Read

這是給重視視覺內容的消費型產品使用者的功能流程，採安靜、editorial 的語言，沿用 EssenceLens 現有的低飽和灰綠基底與暖杏色操作色，使用 Tailwind utility 與 CSS semantic tokens。

本功能不是行銷頁，也不是 dashboard。只套用設計規則中與產品流程直接相關的部分：狀態完整、可及性、responsive、保留圖片比例、避免無必要的動畫與套件。

### 設計刻度

- `DESIGN_VARIANCE: 5`：保留目前首頁左右分欄，但不加入非必要的不對稱裝飾。
- `MOTION_INTENSITY: 3`：只使用狀態切換的 opacity 或 transform，並支援 `prefers-reduced-motion`。
- `VISUAL_DENSITY: 3`：預覽區保留足夠留白，錯誤與檔案資訊只顯示必要內容。

## 目標

完成瀏覽器端的最小圖片流程：

```text
使用者選取檔案
  ↓
取得 File
  ↓
驗證檔案基本資料與圖片是否可解碼
  ↓
建立暫時的 object URL
  ↓
顯示圖片預覽與檔案資訊
  ↓
將原始 File 交給下一個 upload action
```

本階段的完成點是「可以安全地把原始 `File` 交給下一步」，不是完成後端上傳。

## 範圍判斷

### 本階段處理

- 單張圖片選取。
- `File` 的格式、大小、空檔案驗證。
- 使用瀏覽器原生能力確認圖片可以解碼。
- 使用 `URL.createObjectURL` 產生預覽。
- 取代、移除與重新選取同一個檔案。
- 預覽在 idle、validating、ready、error，以及未來 uploading、success、upload-error 狀態下的責任邊界。
- 桌面與手機版版面、鍵盤操作、錯誤提示與 focus state。

### 明確不處理

- 多檔案選取與排序。
- 拖拉上傳區。第一版只保留原生檔案選擇器。
- 圖片裁切、旋轉、壓縮、轉檔或 EXIF 清理。
- base64 或 Data URL 轉換。
- 後端 upload endpoint、儲存服務、登入與權限。
- AI 圖片分析、相似圖片搜尋與 metadata 編輯。
- Pinia。這是單一頁面的暫時流程，不是跨頁狀態。

### 最小假設

- 第一版只接受一個檔案。
- 接受 `image/jpeg`、`image/png`、`image/webp`。
- 單檔上限為 10 MB。
- 不設定最小圖片尺寸，先記錄解碼後的寬高。若後端日後有尺寸限制，再把規則加到同一個 validator。
- `accept` 只負責協助檔案選擇器篩選，不能取代程式驗證。

## 責任邊界

| 層級                           | 責任                                                  | 不負責                                  |
| ------------------------------ | ----------------------------------------------------- | --------------------------------------- |
| `ImageUploadPanel.vue`         | input、按鈕、狀態文案、事件轉接與版面                 | 驗證規則、object URL 生命週期、API 請求 |
| `ImagePreview.vue`             | 顯示圖片、檔名、尺寸與 replace/remove 操作            | 保存 `File`、建立或 revoke URL、上傳    |
| `useImageUpload.ts`            | 保存目前 `File`、狀態、錯誤、預覽 URL，管理選取與清理 | 視覺細節、HTTP 請求                     |
| `image-file.ts`                | 純圖片檔案驗證與圖片解碼                              | Vue state、DOM 顯示、API                |
| `shared/types/image-upload.ts` | 共用 domain types                                     | 執行流程                                |
| `index.vue`                    | 組合 upload panel，將 ready 的 `File` 交給下一階段    | 直接操作 input、直接寫驗證流程          |

原始 `File` 是唯一資料來源。`previewUrl`、檔案尺寸與顯示文字都是由它衍生的流程資料，不得另外複製成第二份可編輯狀態。

## 建議目錄與檔案

```txt
app/
├─ assets/
│  └─ css/
│     └─ main.css                         # 新增 semantic color tokens
├─ components/
│  └─ image-upload/
│     ├─ ImageUploadPanel.vue              # input 與流程 UI
│     └─ ImagePreview.vue                  # ready / uploading 等預覽顯示
├─ composables/
│  └─ useImageUpload.ts                    # File 與 object URL lifecycle
├─ pages/
│  └─ index.vue                            # 組合現有頁面與 upload panel
└─ utils/
   └─ image-file.ts                        # 純驗證與解碼 helper

shared/
└─ types/
   └─ image-upload.ts                      # status、error、state types

tests/
├─ composables/
│  └─ useImageUpload.test.ts
└─ utils/
   └─ image-file.test.ts
```

不新增 service 或 api 檔案。後端契約尚未存在，現在加入會只是空抽象。等 endpoint、FormData 欄位與錯誤格式確定後，再依既有 API/service 分層新增。

## 最小資料模型

```ts
export type ImageUploadStatus = 'idle' | 'validating' | 'ready' | 'error'

export type ImageUploadErrorCode =
  'empty-file' | 'unsupported-type' | 'file-too-large' | 'invalid-image'

export interface ImageDimensions {
  width: number
  height: number
}

export interface ImageUploadState {
  file: File | null
  previewUrl: string | null
  dimensions: ImageDimensions | null
  status: ImageUploadStatus
  errorCode: ImageUploadErrorCode | null
}
```

不為可推導的函式補上 `Promise<void>` 或多餘的泛型。只有 domain data、props、emits 與真正需要約束的 API boundary 才明確標註型別。這個階段沒有 `$fetch<Type>`，因為尚未有 server response。

## 資料流程

### 1. 選取檔案

`ImageUploadPanel` 監聽 input 的 `change`，取得第一個 `File` 後呼叫 composable 的 `selectFile(file)`。

- 不把 `FileList` 存進 state。
- 不在 template 內檢查副檔名或檔案大小。
- `input.value` 在處理後重設，讓使用者可以再次選取同一個檔案。

### 2. 驗證檔案

`image-file.ts` 依序檢查：

1. 檔案存在且 `size > 0`。
2. `file.type` 在允許清單中。
3. `file.size <= 10 MB`。
4. 使用暫時 object URL 搭配瀏覽器圖片解碼，確認內容不是只有副檔名或 MIME 宣稱的圖片。

驗證失敗時：

- 沒有目前有效檔案時，狀態為 `error`，不顯示預覽。
- 已有有效預覽時，保留原本的 `File` 與預覽，只顯示這次新選檔的錯誤，避免使用者因一次誤選而遺失可用內容。
- 驗證失敗時要 revoke 候選 URL；驗證成功時由 composable 接手管理，直到 replace、remove 或 unmount。

### 3. 建立預覽

基本檢查通過後建立一個候選的 `URL.createObjectURL(file)`，用同一個 URL 讓瀏覽器解碼圖片。解碼成功就把它保存於 composable 的 `previewUrl`，解碼失敗就立即 revoke，不另外建立第二個 URL。

- 預覽使用 blob URL，不轉 base64。
- blob URL 只服務瀏覽器顯示，不能送給後端代替原始 `File`。
- 預覽圖片使用 `object-fit: contain`，不裁切使用者選取的內容。
- 預覽容器要預留固定比例或最小高度，避免圖片載入造成 layout shift。
- `ImagePreview` 不自行呼叫 `createObjectURL`，也不自行 revoke URL。

### 4. 取代與移除

- 取代成功時，先 revoke 舊 URL，再保存新 `File` 與新 URL。
- 取代失敗時，保留舊的 ready 狀態與預覽。
- 移除時 revoke 目前 URL，清除 `File`、dimensions、error，回到 `idle`。
- composable unmount 時 revoke 目前 URL，避免 blob URL 累積。

### 5. 交給下一個上傳動作

本階段只提供 `file` 與 ready 狀態給 page。未來真正上傳時必須使用：

```ts
const body = new FormData()
body.append('file', state.file)
```

上傳送出的資料是原始 `File`，不是 `previewUrl`。實際 HTTP 請求要等後端契約明確後，才新增 `api` 與 `service` 層。

## 預覽在流程中的責任

預覽是「選擇確認與狀態回饋」的 UI，不是資料處理層。

### 預覽應該做

- 讓使用者確認選到的是哪張圖片。
- 顯示圖片本身、檔名與可取得的尺寸資訊。
- 提供清楚的「更換圖片」與「移除」操作。
- 在未來 upload 進行中保留圖片，顯示 disabled 或進度狀態，不讓使用者誤以為內容消失。
- 在圖片無法 render 時顯示可理解的錯誤與重新選取入口。
- 將狀態更新放在 `aria-live` 可被輔助技術讀取的區域。

### 預覽不應該做

- 決定允許哪些格式或大小。
- 直接呼叫 `$fetch` 或知道後端 endpoint。
- 將圖片轉成 base64、壓縮或改變原始 `File`。
- 保存跨頁或跨使用者的圖片資料。
- 自己管理 object URL 生命週期。
- 把圖片分析結果、推薦結果或上傳成功當成預覽本身的責任。

## UI 狀態與版面

### 狀態

| 狀態                | 預覽區顯示                     | 可用操作                 |
| ------------------- | ------------------------------ | ------------------------ |
| `idle`              | 選取提示與檔案選擇按鈕         | 選取                     |
| `validating`        | 保留空間，顯示「正在檢查圖片」 | 暫停重複送出             |
| `ready`             | 圖片、檔名、尺寸與移除或更換   | 更換、移除、交給下一步   |
| `error`             | inline 錯誤，不顯示無效圖片    | 重新選取                 |
| 未來 `uploading`    | 保留圖片，顯示上傳中的狀態     | 暫停更換或移除，避免競態 |
| 未來 `success`      | 保留圖片與完成狀態             | 進入下一步               |
| 未來 `upload-error` | 保留圖片與錯誤                 | 重試、重新選取           |

`uploading`、`success`、`upload-error` 只是預留的 UI 邊界，本階段不新增 upload request 或 progress 計算。

### 版面

- 沿用現有首頁的 desktop 左右分欄：左側是流程說明，右側是 upload surface。
- 右側 surface 包含選取入口或預覽，不再額外建立第二個 wizard page。
- 小於 `768px` 時嚴格改為單欄，內容順序為標題、說明、upload surface、主要操作。
- 預覽 frame 使用固定比例與 `object-contain`，圖片不被裁成縮圖。
- 主要操作只有一個，避免「選取圖片」與「開始上傳」在未有 upload API 時同時出現造成誤解。
- 不加入拖拉區、圖片標籤、信心分數、裝飾性 badge 或自動輪播。

### 字體

- 不新增字體套件。沿用 system sans stack，避免為單一流程增加字體載入成本。
- 標題使用較大尺寸與 medium weight，維持現有 editorial 的安靜層次，不使用超大 H1。
- body 與 helper text 使用清楚的 line-height。
- 檔名與尺寸屬於 metadata，使用較小字級但不可低於可讀對比。
- 不使用 mono、serif 或斜體來製造額外風格，除非現有品牌後續明確定義。

### 色彩與 token

新元件禁止直接寫 HEX，也不在 template 內散落具體色值。由 `app/assets/css/main.css` 定義 semantic tokens，再由 Tailwind utility 使用。

| Token                   | 用途                        | 色調方向                  |
| ----------------------- | --------------------------- | ------------------------- |
| `--color-page`          | 頁面背景                    | 低飽和灰綠                |
| `--color-surface`       | upload surface 與預覽 frame | 柔和 off-white            |
| `--color-ink`           | 主要文字                    | 深 charcoal               |
| `--color-muted`         | 說明與 metadata             | 灰綠中性色，保持 AA 對比  |
| `--color-border`        | 邊框與分隔                  | 淡灰綠                    |
| `--color-accent`        | 主要操作與 focus            | 暖杏色                    |
| `--color-accent-strong` | hover 或 active             | 同一色相的較深暖橘        |
| `--color-danger`        | 驗證錯誤                    | 低飽和 rust，僅作語意狀態 |

色彩規則：

- 全頁只保留一個主要 accent 色相，錯誤色只作狀態語意。
- light 與 dark mode 都使用同一組 semantic token 名稱，分別調整值與對比。
- 不使用 AI 紫色漸層、外發光或純黑純白。
- focus ring 必須在 page、surface 與圖片背景上都清楚可見。
- 圓角規則固定：surface 使用同一個 soft radius，互動控制項使用同一個 pill radius，圖片 frame 繼承 surface radius。

### 動畫

- 只做狀態切換的 opacity 或 transform。
- 不做 blob URL 載入動畫、視差、磁吸、無限循環或 canvas 特效。
- `prefers-reduced-motion: reduce` 時移除 transition。

## 錯誤文案

錯誤要直接說明如何修正，不暴露瀏覽器 exception 或內部錯誤。

| Code               | 使用者可見文案方向                     |
| ------------------ | -------------------------------------- |
| `empty-file`       | 這個檔案沒有內容，請重新選取圖片。     |
| `unsupported-type` | 請選擇 JPG、PNG 或 WebP 圖片。         |
| `file-too-large`   | 圖片需要小於 10 MB，請選擇較小的檔案。 |
| `invalid-image`    | 這個檔案無法讀取成圖片，請重新選取。   |

錯誤顯示在欄位附近，並以 `aria-live="polite"` 或等效的可及性方式通知。不要只用 toast，因為錯誤與欄位有直接關係。

## 測試規劃

### `image-file.test.ts`

- 接受 JPEG、PNG、WebP。
- 拒絕不在清單內的 MIME type。
- 拒絕 0 bytes。
- 拒絕超過 10 MB。
- 圖片解碼失敗時回傳 `invalid-image`。
- 解碼成功時回傳 dimensions。

### `useImageUpload.test.ts`

- 初始為 `idle`，沒有 `File` 或 preview URL。
- 選取合法圖片後依序進入 `validating` 與 `ready`。
- 選取無效檔案時為 `error`，不產生可用預覽。
- 有既有合法預覽時，無效 replacement 不會清除舊檔案。
- replace、remove 與 unmount 都會呼叫 `URL.revokeObjectURL`。
- 不會把 preview URL 當作 `File` 保存。

### 驗證指令

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

手動驗證另外包含：鍵盤觸發選取、focus ring、相同檔案重選、手機窄螢幕、light/dark mode、錯誤文案對比，以及瀏覽器無法解碼檔案的 fallback。

## 驗收條件

- [ ] 選取合法 JPG、PNG 或 WebP 後，畫面顯示正確預覽。
- [ ] 原始 `File` 在 composable 中保存，preview URL 只作衍生顯示資料。
- [ ] `accept` 之外仍有程式驗證，不信任副檔名或 input hint。
- [ ] 0 bytes、錯誤 MIME、超過 10 MB、無法解碼的檔案都會顯示 inline error。
- [ ] 驗證失敗不會留下可使用的無效預覽。
- [ ] 以無效檔案取代既有合法檔案時，既有預覽不會遺失。
- [ ] replace、remove、unmount 都會清理 object URL。
- [ ] 重新選取同一個檔案可以再次觸發 change。
- [ ] 預覽不裁切圖片，且容器有預留空間避免 layout shift。
- [ ] 預覽元件不呼叫 API、不執行驗證、不管理 URL lifecycle。
- [ ] 目前不新增 Pinia、第三方圖片處理套件、api 或 service 抽象。
- [ ] 新增或修改的 upload UI 不直接使用 HEX color。
- [ ] 桌面版維持左右分欄，`< 768px` 改為單欄且可讀。
- [ ] 鍵盤、focus、錯誤讀取與 reduced motion 都能正常運作。
- [ ] `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm build` 通過，console 沒有錯誤。

## 後續進入實作時的順序

1. 先新增 shared types 與 `image-file.ts`，以測試固定驗證契約。
2. 再新增 `useImageUpload.ts`，完成 object URL lifecycle 測試。
3. 新增 `ImagePreview.vue` 與 `ImageUploadPanel.vue`，接入 keyboard、focus 與狀態文案。
4. 最後在 `index.vue` 組合，並在 `main.css` 將 upload UI 使用的顏色集中到 semantic tokens。
5. 後端 upload 契約確定後，另開 scope 新增 `api`、`service` 與真正的 uploading state。

## Commit Message

```text
feat(image-upload): define file validation and preview flow
```
