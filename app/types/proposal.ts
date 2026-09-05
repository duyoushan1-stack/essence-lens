/** useProposal 保存的生成狀態，不涵蓋圖片上傳與驗證階段。 */
export type ProposalStatus = 'idle' | 'pending' | 'rejected' | 'success' | 'error'

/** 由上傳與生成狀態推導的畫面狀態，不另保存為可變狀態。 */
export type ProposalFlowStatus = ProposalStatus | 'validating' | 'ready'
