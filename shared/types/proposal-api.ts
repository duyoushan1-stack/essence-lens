/** API 可回傳的錯誤碼，包含業務錯誤、請求無效與冪等鍵衝突。 */
export type ProposalApiErrorCode = ProposalErrorCode | 'request-failed' | 'idempotency-conflict'

/** 成功回應，沿用業務結果並附上請求追蹤識別碼。 */
export interface ProposalApiSuccessResponse extends Extract<
  ProposalOutcome,
  { status: 'success' }
> {
  requestId: string
}

/** 拒絕回應的資料結構，由 API 放入 HTTP 422 錯誤資料。 */
export interface ProposalApiRejectedResponse extends Extract<
  ProposalOutcome,
  { status: 'rejected' }
> {
  requestId: string
}

/** API 執行或請求失敗的資料結構，不代表圖片不符合提案條件。 */
export interface ProposalApiErrorResponse {
  status: 'error'
  requestId: string
  code: ProposalApiErrorCode
}

/** 提案 API 的回應資料聯集；錯誤分支不包含框架的 HTTP 錯誤包裝。 */
export type ProposalApiResponse =
  ProposalApiSuccessResponse | ProposalApiRejectedResponse | ProposalApiErrorResponse
