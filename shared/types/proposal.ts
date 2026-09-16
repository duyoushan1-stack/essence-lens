import type { Proposal as ProposalSchemaType } from '../schemas/proposal'

/** 單筆生成提案的內容，實際 contract 由 shared schema 統一驗證。 */
export type {
  ProposalActivity,
  ProposalItinerary,
  ProposalPerspective
} from '../schemas/proposal'
export type Proposal = ProposalSchemaType

/** 後端在圖片通過可行性檢查後建立的生成輸入，不由前端提交。 */
export interface ProposalContext {
  scene: ImageSemanticAnalysis['scene']
  subjects: ImageSemanticAnalysis['subjects']
  visualMood: string[]
  usefulObjects: string[]
}

/** 圖片不符合提案條件的原因；與系統執行錯誤分開處理。 */
export type ProposalRejectionReason =
  | { category: 'technical'; code: ImageUploadErrorCode }
  | { category: 'safety'; code: SafetyReasonCode }
  | { category: 'theme'; code: ThemeReasonCode }
  | { category: 'information'; code: InformationReasonCode }

/**
 * 將 Provider 或 Server 的 raw error 正規化後使用的穩定錯誤碼。
 * 錯誤碼維持英文字串供 API 與程式判斷，中文註解說明對應的錯誤語意。
 */
export type ProposalErrorCode =
  | 'provider-config-invalid' // Provider 設定缺失或無效
  | 'provider-authentication-failed' // Provider 驗證失敗
  | 'provider-invalid-request' // 傳送給 Provider 的請求格式或參數無效
  | 'provider-unavailable' // Provider 暫時無法使用，可稍後重試
  | 'provider-request-failed' // Provider 請求失敗，但無法歸類為其他明確錯誤
  | 'malformed-provider-response' // Provider 回應格式或內容不符合預期
  | 'proposal-generation-failed' // 提案生成流程失敗
  | 'server-failure' // Server 發生未預期的內部錯誤

/** 僅供 development debug 使用的安全 Provider 資訊，不包含原始錯誤訊息或 payload。 */
export type ProposalProviderStage =
  | 'semantic-analysis'
  | 'grounding'
  | 'proposal-generation'

export interface ProposalValidationIssue {
  path: string
  code: string
}

export interface ProposalDebugProviderInfo {
  provider: string
  statusCode?: number
  providerCode?: string
  stage?: ProposalProviderStage
  validationIssues?: ReadonlyArray<ProposalValidationIssue>
}

/** 開發環境可選擇回傳的安全觀察資料。 */
export interface ProposalDebugInfo {
  provider?: ProposalDebugProviderInfo
  semanticAnalysis?: ImageSemanticAnalysis
}

/** 提案業務流程的最終結果，不包含請求追蹤資訊或 UI 過渡狀態。 */
export type ProposalOutcome =
  | { status: 'success'; proposals: Proposal[] }
  | { status: 'rejected'; reasons: ProposalRejectionReason[] }
  | { status: 'error'; code: ProposalErrorCode }
