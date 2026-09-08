import type {
  AnalyzeSafety,
  AnalyzeSemantics,
  ProviderImageInput
} from '../providers/provider.types'
import { evaluateImageFeasibility } from '../utils/image-feasibility-policy'
import { normalizeProviderError } from '../utils/providers/error'
import { withRetry } from '../utils/retry-policy'
import type { ProposalDebugInfo } from '../../shared/types/proposal'

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024

export interface ImageFeasibilityServiceDependencies {
  analyzeSafety: AnalyzeSafety
  analyzeSemantics: AnalyzeSemantics
}

export interface ImageFeasibilityServiceOptions {
  includeDebug?: boolean
}

export type ImageFeasibilityServiceResult =
  | { status: 'accepted'; context: ProposalContext; debug?: ProposalDebugInfo }
  | { status: 'rejected'; reasons: ProposalRejectionReason[]; debug?: ProposalDebugInfo }
  | { status: 'error'; code: ProposalErrorCode; debug?: ProposalDebugInfo }

const validateTechnicalInput = (input: ProviderImageInput): ProposalRejectionReason | null => {
  if (input.bytes.byteLength === 0) {
    return { category: 'technical', code: 'empty-file' }
  }

  if (!ACCEPTED_IMAGE_TYPES.has(input.mimeType)) {
    return { category: 'technical', code: 'unsupported-type' }
  }

  if (input.bytes.byteLength > MAX_IMAGE_SIZE_BYTES) {
    return { category: 'technical', code: 'file-too-large' }
  }

  return null
}

const toProposalContext = (analysis: ImageSemanticAnalysis): ProposalContext => ({
  scene: analysis.scene,
  subjects: analysis.subjects,
  visualMood: analysis.visualMood,
  usefulObjects: analysis.usefulObjects
})

const toProductReasons = (reasons: ImageFeasibilityReason[]): ProposalRejectionReason[] => {
  const productReasons: ProposalRejectionReason[] = []

  for (const reason of reasons) {
    if (reason.category === 'system') {
      continue
    }

    if (reason.category === 'safety') {
      productReasons.push({ category: 'safety', code: reason.code })
      continue
    }

    if (reason.category === 'theme') {
      productReasons.push({ category: 'theme', code: reason.code })
      continue
    }

    productReasons.push({ category: 'information', code: reason.code })
  }

  return productReasons
}

const toProviderErrorResult = (
  error: unknown,
  provider: string,
  includeDebug: boolean
): Extract<ImageFeasibilityServiceResult, { status: 'error' }> => {
  const normalizedError = normalizeProviderError(error, provider)

  const codeByKind: Record<ReturnType<typeof normalizeProviderError>['kind'], ProposalErrorCode> = {
    configuration: 'provider-config-invalid',
    authentication: 'provider-authentication-failed',
    'invalid-request': 'provider-invalid-request',
    transient: 'provider-unavailable',
    'invalid-response': 'malformed-provider-response',
    unknown: 'provider-request-failed'
  }

  const { provider: normalizedProvider, statusCode, providerCode } = normalizedError

  return {
    status: 'error',
    code: codeByKind[normalizedError.kind],
    ...(includeDebug
      ? {
          debug: {
            provider: {
              provider: normalizedProvider ?? provider,
              ...(statusCode !== undefined ? { statusCode } : {}),
              ...(providerCode !== undefined ? { providerCode } : {})
            }
          }
        }
      : {})
  }
}

export const evaluateImageFeasibilityForFile = async (
  input: ProviderImageInput,
  dependencies: ImageFeasibilityServiceDependencies,
  options: ImageFeasibilityServiceOptions = {}
): Promise<ImageFeasibilityServiceResult> => {
  const technicalReason = validateTechnicalInput(input)

  if (technicalReason) {
    return { status: 'rejected', reasons: [technicalReason] }
  }

  let contentSafety

  try {
    contentSafety = await withRetry(() => dependencies.analyzeSafety(input))
  } catch (error: unknown) {
    return toProviderErrorResult(error, 'azure-content-safety', options.includeDebug === true)
  }

  const hasSafetyFinding = Object.values(contentSafety.categories).some((severity) => severity > 0)

  if (hasSafetyFinding) {
    const safetyResult = evaluateImageFeasibility({
      contentSafety,
      semanticAnalysis: null
    })

    return { status: 'rejected', reasons: toProductReasons(safetyResult.reasons) }
  }

  let semanticAnalysis

  try {
    semanticAnalysis = await withRetry(() => dependencies.analyzeSemantics(input))
  } catch (error: unknown) {
    return toProviderErrorResult(error, 'gemini', options.includeDebug === true)
  }

  const feasibilityResult = evaluateImageFeasibility({
    contentSafety,
    semanticAnalysis
  })

  if (feasibilityResult.reasons.some((reason) => reason.category === 'system')) {
    return {
      status: 'error',
      code: 'malformed-provider-response',
      ...(options.includeDebug ? { debug: { semanticAnalysis } } : {})
    }
  }

  if (feasibilityResult.decision === 'reject') {
    return {
      status: 'rejected',
      reasons: toProductReasons(feasibilityResult.reasons),
      ...(options.includeDebug ? { debug: { semanticAnalysis } } : {})
    }
  }

  return {
    status: 'accepted',
    context: toProposalContext(semanticAnalysis),
    ...(options.includeDebug ? { debug: { semanticAnalysis } } : {})
  }
}
