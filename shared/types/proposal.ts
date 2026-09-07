/** 單筆生成提案的內容，供前後端共用。 */
export interface Proposal {
  title: string
  description: string
}

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
  | 'provider-unavailable'
  | 'malformed-provider-response'
  | 'proposal-generation-failed'
  | 'server-failure'

/** 提案業務流程的最終結果，不包含請求追蹤資訊或 UI 過渡狀態。 */
export type ProposalOutcome =
  | { status: 'success'; proposals: Proposal[] }
  | { status: 'rejected'; reasons: ProposalRejectionReason[] }
  | { status: 'error'; code: ProposalErrorCode }
