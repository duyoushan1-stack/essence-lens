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

/** 可行性分析、提案生成或 Server 執行失敗的錯誤碼，不含 HTTP 請求層錯誤。 */
export type ProposalErrorCode =
  | 'provider-config-invalid'
  | 'provider-authentication-failed'
  | 'provider-invalid-request'
  | 'provider-unavailable'
  | 'provider-request-failed'
  | 'malformed-provider-response'
  | 'proposal-generation-failed'
  | 'server-failure'

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
