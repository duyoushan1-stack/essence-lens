import type { AnalyzeSafety, AnalyzeSemantics, ProviderImageInput } from '../providers/provider.types'
import { evaluateImageFeasibility } from '../utils/image-feasibility-policy'

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024

export interface ImageFeasibilityServiceDependencies {
  analyzeSafety: AnalyzeSafety
  analyzeSemantics: AnalyzeSemantics
}

export type ImageFeasibilityServiceResult =
  | { status: 'accepted'; context: ProposalContext }
  | { status: 'rejected'; reasons: ProposalRejectionReason[] }
  | { status: 'error'; code: ProposalErrorCode }

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

export const evaluateImageFeasibilityForFile = async (
  input: ProviderImageInput,
  dependencies: ImageFeasibilityServiceDependencies
): Promise<ImageFeasibilityServiceResult> => {
  const technicalReason = validateTechnicalInput(input)

  if (technicalReason) {
    return { status: 'rejected', reasons: [technicalReason] }
  }

  let contentSafety

  try {
    contentSafety = await dependencies.analyzeSafety(input)
  } catch {
    return { status: 'error', code: 'provider-unavailable' }
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
    semanticAnalysis = await dependencies.analyzeSemantics(input)
  } catch {
    return { status: 'error', code: 'provider-unavailable' }
  }

  const feasibilityResult = evaluateImageFeasibility({
    contentSafety,
    semanticAnalysis
  })

  if (feasibilityResult.reasons.some((reason) => reason.category === 'system')) {
    return { status: 'error', code: 'malformed-provider-response' }
  }

  if (feasibilityResult.decision === 'reject') {
    return { status: 'rejected', reasons: toProductReasons(feasibilityResult.reasons) }
  }

  return { status: 'accepted', context: toProposalContext(semanticAnalysis) }
}
