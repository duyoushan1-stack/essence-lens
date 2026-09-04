import type {
  ImageFeasibilityReason,
  InformationReasonCode,
  SafetyReasonCode,
  ThemeReasonCode
} from './image-feasibility'
import type { ImageUploadErrorCode } from './image-upload'
import type { Proposal } from './proposal'

export type ProposalFlowStatus =
  'idle' | 'validating' | 'ready' | 'pending' | 'rejected' | 'error' | 'success'

export type ProposalRejectionReason =
  | { category: 'technical'; code: ImageUploadErrorCode }
  | { category: 'safety'; code: SafetyReasonCode }
  | { category: 'theme'; code: ThemeReasonCode }
  | { category: 'information'; code: InformationReasonCode }

export type ProposalErrorCode =
  | 'provider-unavailable'
  | 'malformed-provider-response'
  | 'proposal-generation-failed'
  | 'request-failed'

export type ProposalOutcome =
  | { status: 'success'; proposals: Proposal[] }
  | { status: 'rejected'; reasons: ProposalRejectionReason[] }
  | { status: 'error'; code: ProposalErrorCode }

export interface ProposalApiSuccessResponse {
  status: 'success'
  requestId: string
  proposals: Proposal[]
}

export interface ProposalApiRejectedResponse {
  status: 'rejected'
  requestId: string
  reasons: ProposalRejectionReason[]
}

export interface ProposalApiErrorResponse {
  status: 'error'
  requestId: string
  code: ProposalErrorCode
}

export type ProposalApiResponse =
  ProposalApiSuccessResponse | ProposalApiRejectedResponse | ProposalApiErrorResponse

export type ProductFeasibilityReason = Exclude<ImageFeasibilityReason, { category: 'system' }>
