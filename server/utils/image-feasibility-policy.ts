import type {
  ContentSafetyAssessment,
  ImageFeasibilityInput,
  ImageFeasibilityReason,
  ImageFeasibilityResult,
  ImageSemanticAnalysis,
  InformationReasonCode,
  SafetyReasonCode,
  ThemeReasonCode
} from '~~/shared/types/image-feasibility'

const SAFETY_CATEGORIES: ReadonlyArray<
  readonly [keyof ContentSafetyAssessment['categories'], SafetyReasonCode]
> = [
  ['hate', 'hate'],
  ['self-harm', 'self-harm'],
  ['sexual', 'sexual'],
  ['violence', 'violence']
]

const addSafetyReasons = (
  assessment: ContentSafetyAssessment,
  reasons: ImageFeasibilityReason[]
) => {
  for (const [category, code] of SAFETY_CATEGORIES) {
    if (assessment.categories[category] > 0) {
      reasons.push({ category: 'safety', code })
    }
  }
}

const addSemanticReasons = (analysis: ImageSemanticAnalysis, reasons: ImageFeasibilityReason[]) => {
  const safetySignals: ReadonlyArray<
    readonly [keyof ImageSemanticAnalysis['safety'], SafetyReasonCode]
  > = [
    ['nudity', 'nudity'],
    ['sexual', 'sexual'],
    ['violence', 'violence'],
    ['gore', 'gore']
  ]

  for (const [signal, code] of safetySignals) {
    if (analysis.safety[signal] === 'present') {
      reasons.push({ category: 'safety', code })
    }
  }

  const themeSignals: ReadonlyArray<
    readonly [keyof ImageSemanticAnalysis['subjects'], ThemeReasonCode]
  > = [
    ['isSelfie', 'selfie'],
    ['hasProductFocus', 'product-photo'],
    ['isMemeLike', 'meme-like'],
    ['hasPetCloseup', 'pet-closeup']
  ]

  for (const [signal, code] of themeSignals) {
    if (analysis.subjects[signal] === 'present') {
      reasons.push({ category: 'theme', code })
    }
  }

  if (analysis.quality.isSolidColor === 'present') {
    const code: InformationReasonCode = 'solid-color'
    reasons.push({ category: 'information', code })
  }

  if (analysis.quality.blur === 'severe') {
    const code: InformationReasonCode = 'severely-blurred'
    reasons.push({ category: 'information', code })
  }

  if (!analysis.scene.recognizable) {
    const code: InformationReasonCode = 'unrecognizable-scene'
    reasons.push({ category: 'information', code })
  }

  if (!analysis.quality.informationSufficient) {
    const code: InformationReasonCode = 'insufficient-information'
    reasons.push({ category: 'information', code })
  }
}

const hasUnknownCriticalSignal = (analysis: ImageSemanticAnalysis) =>
  Object.values(analysis.safety).includes('unknown') ||
  Object.values(analysis.subjects).some((value) => value === 'unknown') ||
  analysis.scene.category === 'unknown' ||
  analysis.quality.isSolidColor === 'unknown' ||
  analysis.quality.blur === 'unknown'

export const evaluateImageFeasibility = ({
  contentSafety,
  semanticAnalysis
}: ImageFeasibilityInput): ImageFeasibilityResult => {
  const reasons: ImageFeasibilityReason[] = []

  if (!contentSafety) {
    return {
      decision: 'reject',
      reasons: [{ category: 'system', code: 'analysis-unavailable' }]
    }
  }

  addSafetyReasons(contentSafety, reasons)

  if (reasons.length > 0) {
    return { decision: 'reject', reasons }
  }

  if (!semanticAnalysis) {
    return {
      decision: 'reject',
      reasons: [{ category: 'system', code: 'analysis-unavailable' }]
    }
  }

  addSemanticReasons(semanticAnalysis, reasons)

  if (hasUnknownCriticalSignal(semanticAnalysis)) {
    reasons.push({ category: 'system', code: 'analysis-unavailable' })
  }

  return {
    decision: reasons.length > 0 ? 'reject' : 'accept',
    reasons
  }
}
