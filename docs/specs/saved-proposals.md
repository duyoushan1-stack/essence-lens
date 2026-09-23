# 儲存提案卡 MVP 實作規格

日期：2026-09-18  
狀態：規格草案，尚未實作  
已確認決策：免登入、本機收藏；雲端同步留到下一階段。

## 1. 目的與依據

使用者能收藏生成的提案，重新開啟同一網站後仍能在收件匣搜尋、分類瀏覽及取消收藏。

依據優先順序：使用者明確需求 → 現有程式架構 → 三張桌面、平板、手機設計稿。設計稿中的文字是設計參考，不構成額外功能授權。

已查看 https://essence-lens.ai.studio/：首頁有品牌、探索提案、我的收藏、收件匣與圖片上傳區；點擊收件匣後未觀察到換頁，不能據此斷言線上已具備收藏功能。線上畫面與本機程式不同，實作以本機為準。

本機查核：

- 實際框架為 Nuxt 4、Vue 3、TypeScript、TailwindCSS 4，不另建 Vite 專案或手動 Router。
- 已有 Zod、Nuxt Icon、line-md 圖示及 Vitest；目前沒有 Pinia、Firebase 或 IndexedDB 套件。
- `app/components/proposal/Card.vue` 的 `isFavorite` 是元件區域狀態，只有愛心切換，沒有持久化。
- `shared/schemas/proposal.ts` 是 Proposal 的唯一 runtime schema；`perspective` 可省略。
- `server/services/proposal.service.ts` 使用 UUID 建立提案 ID。
- `useImageUpload.ts` 在換圖、移除及卸載時釋放預覽網址，不能把該網址直接當永久封面。
- 目前分支為 `dev`；`app/composables/useProposal.ts` 有既有未提交修改，本功能不覆寫。

## 2. MVP 範圍

包含：

1. 提案愛心的收藏／取消收藏，真實持久化與失敗回饋。
2. 固定右上角的「首頁」「收件匣」導覽，收件匣數量來自真實資料。
3. `/saved-proposals` 收件匣頁。
4. 搜尋已收藏提案、依預設分類篩選、依收藏日期排序。
5. 桌面／平板卡片網格、手機橫式清單。
6. 點開收藏後閱讀完整內容，使用原生 dialog 與既有提案呈現。
7. 空資料、無搜尋結果、讀取中、儲存失敗、圖片失效等狀態。

本版預留資料結構，但不實作自訂分類管理介面。登入、跨裝置、分享、拖拉排序、批次刪除、多層資料夾、離線開啟整個網站、首頁生成歷史皆不納入。

設計稿的帳號頭像、底部分頁導覽、示例日期、城市／咖啡／療癒等分類不直接照搬。現有資料沒有「建議季節」或三張附圖，介面不虛構這些欄位。

## 3. 視覺與響應式規格

設計判讀：延續 Essence Lens 的生活靈感介面，以照片、淡綠灰背景、深墨綠文字、柔和圓角與琥珀色收藏回饋為主。

採 `design-taste-frontend` 的保留式改版原則；這是功能頁，不套用其 React 預設、行銷頁區塊限制或額外動畫依賴。DESIGN_VARIANCE=5、MOTION_INTENSITY=3、VISUAL_DENSITY=3。

- 沿用 `main.css` 的 page、surface、ink、muted、border、accent token 與背景圖。
- 保留首頁生成流程、卡片堆疊及既有行程展開互動。
- 收藏列表卡片圓角 16px，封面 12px，搜尋框與分類按鈕採膠囊形狀。
- 愛心使用既有 line-md 圖示。未收藏為線框，已收藏為實心暖色，搭配 `aria-pressed`，不只靠色彩區別。
- 互動過渡約 160–220ms，僅用於 hover、按下、收藏回饋；尊重 reduced motion。
- 文字、placeholder、focus ring 檢查對比；透明導覽在背景上保持可讀性。

| 畫面寬度   | 收件匣呈現                                                 | 操作列                                   |
| ---------- | ---------------------------------------------------------- | ---------------------------------------- |
| <768px     | 單欄橫式清單，左方約 80px 縮圖，右方標題、分類、地點與日期 | 分類可水平捲動；搜尋全寬；數量與排序另列 |
| 768–1023px | 兩欄卡片網格                                               | 分類與搜尋允許分列                       |
| ≥1024px    | 三欄卡片網格，內容最大寬度約 1200px                        | 空間足夠才合為一列                       |

觸控目標至少 44×44px；長標題列表最多兩行，詳情顯示完整文字。驗收包含 320、390、768、1024、1440px 與 200% 縮放。

## 4. 導覽與搜尋

### 固定導覽

- 在 `app.vue` 掛載共用導覽，使用 NuxtLink。
- 首頁連結為 `/`，對應現有 `app/pages/index.vue`；收件匣為 `/saved-proposals`。
- `position: fixed`，右上角，透明背景，沒有整條 header、底色或陰影，也不在文流佔高度。
- 桌面邊距約 24px，手機 16px，納入 safe-area inset。
- 層級規劃：一般內容 0、導覽 40、通知 50；原生 modal dialog 使用 top layer。
- 內容本身保留可操作的頂部安全空間，避免標題與固定按鈕相撞；不使用空白 header 撐高。
- 容器只覆蓋按鈕所需區域，不能形成整頁透明攔截層。
- 數量尚未載入時不顯示假數字；`0` 可隱藏 badge。狀態同步後顯示真實總收藏數。

### 搜尋定義

本規格將 search bar 定義為「收件匣內搜尋已收藏提案」，不是新的 AI 生成輸入，也不搜尋尚未收藏的結果。

- placeholder：「搜尋收藏的提案…」；提供獨立可存取名稱及清除按鈕。
- 搜尋欄位：title、summary、location.name、location.address。
- 文字先 trim 並正規化大小寫；以完整輸入字串做子字串比對。本版不做模糊、拼音或語意搜尋。
- 搜尋與分類取交集；不呼叫後端、不重新生成提案。
- URL query 為條件唯一來源：`q`、`category`、`sort`。
- input 只有編輯中的暫存值；約 200ms 後用 `router.replace` 更新 q，避開中文輸入法組字期間。清除搜尋立即更新。
- `category` 預設 all；`sort` 預設 newest，另一選項 oldest。無效 query 回到預設，不讓頁面出錯。
- 瀏覽器返回時還原 query；沒有結果顯示「找不到符合的提案」與「清除篩選」。

## 5. 收藏與閱讀流程

1. 使用者點擊首頁提案的愛心。
2. 該提案進入 pending，暫停重複操作；阻止 click 與 pointerdown 傳入卡片滑動手勢。
3. 將提案快照與必要封面資料寫入 IndexedDB。
4. transaction 成功才更新 store、愛心與收件匣計數。
5. 顯示約 4 秒的 `role=status` 通知：「已加入收藏，可至右上收件匣查看」。提供關閉，不搶焦點。
6. 失敗時維持原狀，顯示「收藏未儲存，請再試一次」；空間不足或瀏覽器禁止儲存時給對應文字。

取消收藏同樣先確認本機寫入成功，再更新 UI；完成後提供短暫「復原」，復原亦需確認寫入成功。刪除失敗時不得把卡片從畫面永久移走。

- 以 Proposal.id 去重。同一 ID 再次保存不增加筆數、不重設首次收藏時間。
- 取消後重新收藏視為新一次收藏，更新 savedAt。
- 重新生成即使標題相同，只要 ID 不同就視為不同提案，不以標題猜測重複。
- 卡片的標題／封面按鈕開啟 dialog，愛心為獨立按鈕，不巢狀放入另一個 button。
- dialog 顯示收藏快照的完整標題、摘要、行程、地點與封面；Esc 關閉，關閉後恢復觸發點焦點。
- 首頁未收藏的生成結果仍遵循現有生命週期；本版不另做草稿保存或以全頁 KeepAlive 留住 File／blob URL。

## 6. 分類模型

`perspective` 是 AI 生成內容的語意，不應為了使用者自訂收藏夾而擴張 enum。

| 原始值  | 介面名稱 | 分類識別            |
| ------- | -------- | ------------------- |
| nature  | 自然     | perspective:nature  |
| coast   | 海岸     | perspective:coast   |
| culture | 文化     | perspective:culture |
| food    | 食物     | perspective:food    |
| active  | 冒險     | perspective:active  |
| rest    | 悠閒     | perspective:rest    |

- 「全部」為查詢條件，不是資料分類。
- perspective 缺少時歸「未分類」，有此類資料才顯示該篩選。
- 預設分類由提案 perspective 推導，不在收藏記錄複製一份可變 defaultCategoryId。
- 六種分類名稱與順序集中於一個常數檔；keys 依既有 schema 推導並以 TypeScript 檢查完整映射。
- 收藏記錄預留 `customCategoryIds: string[]`，首版為空陣列，不顯示無效的「新增」按鈕。
- 未來自訂分類使用 `custom:<uuid>` 的獨立 ID 及可修改名稱；新增、改名不改 Proposal schema。
- 未來一張提案可加入多個自訂分類，仍保留其預設分類；刪除自訂分類僅解除關聯，不刪提案。
- 「分項」在此解讀為新增平行分類，不做階層式子分類樹。

## 7. 資料契約與圖片

以下為設計契約，落地時由 Zod schema 推導型別，不手寫兩份相同的 runtime 與 TypeScript 定義。

```ts
type SavedProposalRecord = {
  schemaVersion: 1
  proposal: Proposal
  savedAt: string // UTC ISO 8601
  updatedAt: string // UTC ISO 8601
  customCategoryIds: string[]
}

type LocalSavedProposalEntry = {
  record: SavedProposalRecord
  coverBlob?: Blob // 只屬於本機儲存層，不進 Firestore 文件
}
```

儲存 key 使用 `proposal:${proposal.id}`。快照保存完整 Proposal，收藏後不因目前生成結果被 reset 而消失。沒有額外 `isSaved` 欄位；存在該筆記錄即代表已收藏。

收藏數量可以是 0 或超過 3；不能沿用限制 1–3 筆生成結果的 proposalListSchema 驗證收藏列表。

圖片規則：

- 收藏快照仍保留原始 cover 描述，但本機顯示優先使用持久化 Blob。
- 使用上傳圖作 fallback 時，從仍有效的 File／Blob 取得圖片資料再保存，不能只記錄 `blob:` 字串。
- 將需本機保存的封面以瀏覽器 Canvas 縮至最長邊 1280px、WebP 約 0.8 品質，目標不超過 1MB；保留格式失敗時給可恢復錯誤，不回報完整成功。
- 遠端生成封面只在 CORS 允許時嘗試取得 Blob；不為此新增通用圖片代理。設置有限逾時，不能無限卡住收藏。
- 無法取得遠端 Blob 時仍可保存文字與原 URL，清楚回饋「提案已收藏，封面未離線保存」。本版不承諾第三方 URL 永久有效。
- 從 Blob 建立的 object URL 只存在展示層，離開或替換時 revoke，不寫入 schema 或 Pinia 持久化 JSON。
- 圖片載入失敗顯示一致比例的「封面暫時無法顯示」，文字內容及取消收藏仍可操作。
- 本機圖片與該筆 record 放同一筆 IndexedDB entry，讓收藏與刪除具備單筆交易原子性；MVP 接受不同收藏可能重複保存相同縮圖。

## 8. 分層、套件與單一資料來源

採單向資料流：UI → Pinia action → saved-proposal.service → IndexedDB。

| 層               | 責任                                                     |
| ---------------- | -------------------------------------------------------- |
| component        | 呈現、鍵盤互動、typed props/emits，無直接資料庫存取      |
| page             | query 條件與畫面組裝，不處理 IndexedDB 流程              |
| store            | 唯一跨頁收藏集合、loading/error/pending 狀態及持久化協調 |
| service          | 驗證、快照、去重與本機讀寫；對上提供簡單函式             |
| composable       | 封面 object URL 建立與釋放，只有需要重用時拆出           |
| schema/constants | 契約、分類 mapping 與 schemaVersion                      |

新增 `pinia` 與 `@pinia/nuxt`，遵守本專案跨頁狀態標準；不再平行用 useState 保存同一批收藏。

IndexedDB 使用小型 `idb-keyval`，避免手寫 open、upgrade、request、transaction 生命週期。此為框架無關的 TypeScript 套件，可用於 Vue 3。部署實作時再確認相容版本與鎖檔，這輪不安裝。

沿用 Nuxt Icon、Zod、原生 input/select/dialog 與 Vue Transition。不加入 UI framework、搜尋引擎、Firebase SDK、TanStack Query 或為單一通知引入全站 toast 系統。

service 對上只需 listSavedProposals、saveProposal、removeSavedProposal；先不建立 repository interface、factory 或兩套 adapter。未來換 service 的儲存實作時，UI 不必知道 IndexedDB／Firestore。

細節約束：

- 只在 client mounted 後存取 IndexedDB；SSR 不讀 window、Blob、indexedDB。
- 初始 loading 完成前禁用依賴收藏狀態的按鈕，避免尚未載入就覆蓋資料或閃出錯誤愛心。
- 將 Vue reactive Proposal 轉成經 schema 驗證的普通快照後保存，避免 structured clone Proxy 失敗。
- Pinia 保存可序列化的 record 與操作狀態，Blob 留在 service／展示 composable，不進 SSR payload。
- 每筆記錄獨立讀寫，不整批覆蓋陣列；使用原子 update 保護同 ID 的首次 savedAt。
- 跨分頁用 BroadcastChannel 傳遞「資料已變更」訊號後重新讀取，並以 focus refresh 作 fallback；不承諾跨裝置同步。
- 讀取失敗與「目前沒有收藏」分開；損壞的個別記錄保留在 DB、略過顯示並提示，不能清空整個資料庫。
- unknown schemaVersion 不自動覆寫；先顯示版本不支援的可恢復狀態。

## 9. IndexedDB 與 Firebase 的決策

**本版選 IndexedDB。** 使用者已確認先本機收藏，所以登入、帳號與雲端權限不應成為首版依賴。

| 面向       | IndexedDB MVP                          | 未來 Firebase                              |
| ---------- | -------------------------------------- | ------------------------------------------ |
| 保存位置   | 同一瀏覽器、同一網站 origin            | Firestore，依登入帳號隔離                  |
| 換裝置     | 無法自動取得                           | 可在同帳號下取得                           |
| 身分       | 不需要登入                             | Firebase Auth                              |
| 圖片二進位 | IndexedDB Blob                         | Cloud Storage，文件只存引用                |
| 離線       | 已保存資料可本機讀取；網站本身另需載入 | Firestore 可配置離線快取與恢復連線同步     |
| 工作量     | 本機讀寫、錯誤處理、圖片生命週期       | 另加 Auth、Rules、同步、資源權限與用量管理 |

IndexedDB 不是雲端備份。頁面需簡短顯示「收藏儲存在此瀏覽器，尚未同步至雲端」。清除網站資料、瀏覽器儲存回收或換 origin 都可能使資料不可取得。[MDN 儲存說明](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

AI Studio 確實有 Firestore 與 Firebase Authentication 整合；這是其開發便利性，不代表每個 MVP 都必須使用。[Firebase 官方整合說明](https://firebase.google.com/docs/ai-assistance/ai-studio-integration)

Firestore 自己已有離線快取及同步機制；Web 持久快取需要配置。導入後優先讓 SDK 管理，避免同時維護獨立 IndexedDB 雙向同步引擎。[Firestore 離線文件](https://firebase.google.com/docs/firestore/manage-data/enable-offline)

## 10. 遷移至 Firebase 的明確邊界

可以平順演進，但不是更換套件就自動搬完資料。service 邊界降低程式修改成本；資料搬移仍要實作。

未來程序：

1. 導入可跨裝置登入的 Firebase Auth。不要把僅存在此裝置的匿名身分當作完整的跨裝置帳號。
2. 登入後提供「將此瀏覽器收藏加入目前帳號」的明確操作，顯示目標帳號與筆數；不默默上傳共用裝置的收藏或圖片。
3. 逐筆驗證 schemaVersion，保留 Proposal.id、原始 savedAt、updatedAt 與自訂分類 ID。
4. 資料目標建議 `users/{uid}/savedProposals/{proposalId}`；自訂分類另存 `users/{uid}/categories/{categoryId}`。
5. 需要保存的 Blob 上傳 Cloud Storage，Firestore 文件保存 storagePath 等引用；不把 Blob/base64 塞入文件。ISO 時間在 service 邊界轉為 SDK 支援的時間表示。
6. 使用固定 proposalId 和媒體路徑，讓重試具冪等性；雲端已有同 ID 時不盲目覆蓋雲端編輯，預設保留雲端並列出略過項目。
7. 記錄成功／失敗清單。只有伺服器確認成功才標記完成；中途失敗可重試，原本本機資料不立即刪除。
8. 雲端模式以 Firestore 為權威資料來源，Pinia 若仍保留列表，僅為 SDK 訂閱的 UI 投影，不另建平行可變快取。登出／換帳號時卸載訂閱並清除前一帳號的記憶體資料，避免混合顯示。
9. Firestore 與 Storage Rules 限制使用者只能存取自己的資料，搭配 schema／大小檢查及 Emulator 測試。[Firebase Rules](https://firebase.google.com/docs/rules/basics)

特別注意：localhost、ai.studio 網域與未來自有網域是不同 origin，不能直接讀取彼此的 IndexedDB。若要換域，必須在舊網域仍可使用時先做雲端匯入，或另做匯出／匯入功能；本版沒有承諾這個功能。[MDN 同源限制](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## 11. 檔案規劃與實作順序

本功能預計超過 3 個檔案，以下先提供完整方案；此輪只新增本規格書。

| 檔案                                                                              | 變更                                                           |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `shared/schemas/saved-proposal.ts`                                                | 新增收藏 record schema 與衍生型別，重用 proposalSchema         |
| `app/constants/proposal-categories.ts`                                            | 預設分類顯示 mapping                                           |
| `app/services/saved-proposal.service.ts`                                          | 本機保存、讀取、刪除與資料驗證                                 |
| `app/stores/saved-proposals.store.ts`                                             | 收藏集合、載入與操作狀態                                       |
| `app/composables/useSavedProposalCover.ts`                                        | Blob 顯示網址與清理；圖片處理過長再獨立純工具                  |
| `app/components/layout/FloatingNav.vue`                                           | 固定透明導覽及真實數量                                         |
| `app/components/proposal/SaveButton.vue`                                          | 共用收藏按鈕與可存取狀態                                       |
| `app/components/saved-proposal/Card.vue`                                          | 桌面與手機收藏摘要呈現                                         |
| `app/components/saved-proposal/DetailDialog.vue`                                  | 原生 dialog，重用既有完整提案卡                                |
| `app/pages/saved-proposals.vue`                                                   | 搜尋、分類、排序與頁面狀態                                     |
| `app/components/proposal/Card.vue`                                                | 移除區域 isFavorite，接入共用收藏按鈕與 typed event            |
| `app/components/proposal/CardStack.vue`、`ResultPanel.vue`、`app/pages/index.vue` | 傳遞收藏事件／狀態及可持久化的 fallback 圖片，保留既有生成責任 |
| `app/app.vue`                                                                     | 掛載導覽及共享操作通知；不全頁 KeepAlive                       |
| `nuxt.config.ts`、`package.json`、`pnpm-lock.yaml`                                | Pinia module 與最小套件依賴                                    |
| `tests/unit/`、`tests/nuxt/`、必要真實瀏覽器測試                                  | 依現有專案配置補足核心回歸                                     |

實作順序：資料契約與本機持久化 → store 與收藏按鈕 → 導覽及收件匣 → 詳情／圖片／錯誤狀態 → 真實瀏覽器與 RWD 驗證。

實作分支建議 `codex/feature/saved-proposals`，不直接修改 main，不自動提交或部署。

## 12. 驗收與測試

- 收藏同一 ID 兩次只有一筆；transaction 失敗不顯示成功、不增加數量。
- 取消收藏成功後首頁與收件匣一致；復原可恢復快照；連點不產生競態。
- 重整與重新開啟同 origin 後，提案文字和已保存的 fallback 封面仍存在。
- IndexedDB 不可用、配額不足、損壞記錄及未知 schemaVersion 均有明確狀態，不假裝空收藏。
- 0 筆與超過 3 筆收藏都合法；沒有 perspective 的提案能在全部／未分類找到。
- 搜尋、分類及排序組合正確；清除、中文組字、返回與無效 query 可用；同時間以 ID 作穩定排序次鍵。
- `/saved-proposals` 可直接開啟與重新整理，SSR 沒有 window／indexedDB 錯誤或 hydration mismatch。
- 兩個同 origin 分頁修改後可更新狀態；圖片失效不影響文字閱讀。
- 收藏按鈕不觸發卡片 swipe；原有上傳、生成、重試、行程展開與卡片動畫不回歸。
- 手機無水平頁面溢位，透明 fixed 導覽不擋標題／控制項；鍵盤 focus、dialog 焦點返回、Esc 與 reduced motion 正常。

自動測試集中驗證 service/store 的去重、交易失敗、狀態一致性，以及搜尋分類語意。IndexedDB 交易與 Blob 重開行為須在真實瀏覽器驗證，不以 happy-dom 元件測試代替。

執行 `pnpm typecheck`、`pnpm lint`、相關 Vitest tests；涉及共用卡片時再跑既有生成／動畫回歸，最後 `pnpm build` 與上述尺寸手動驗收。本輪僅交付文件，尚未執行功能測試。

建議未來功能 commit：`feat(saved-proposals): add local proposal saving and inbox`。

## 13. 補充來源

- [idb-keyval 官方原始碼與 API](https://github.com/jakearchibald/idb-keyval)：Promise API、Blob 保存與原子 update。
- [Pinia 的 Nuxt 整合](https://pinia.vuejs.org/ssr/nuxt.html)：Nuxt module 與 SSR 使用方式。

規格預設待後續需求改動時才調整：搜尋只查收藏；自訂分類此次僅預留；分項不含階層樹；沒有登入、雲端與批次管理。
