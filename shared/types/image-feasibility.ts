export type ContentSafetySeverity = 0 | 2 | 4 | 6

export type ContentSafetyCategory = 'hate' | 'self-harm' | 'sexual' | 'violence'

export interface ContentSafetyAssessment {
  provider: 'azure-content-safety'
  apiVersion: string
  categories: Record<ContentSafetyCategory, ContentSafetySeverity>
}

export type SemanticSignal = 'absent' | 'present' | 'unknown'

export type BlurLevel = 'none' | 'mild' | 'severe' | 'unknown'

export type SceneCategory = 'indoor' | 'outdoor' | 'nature' | 'urban' | 'unknown'

export interface ImageSemanticAnalysis {
  schemaVersion: string
  scene: {
    category: SceneCategory
    recognizable: boolean
  }
  subjects: {
    peopleCount: number | null
    isSelfie: SemanticSignal
    hasProductFocus: SemanticSignal
    hasPetCloseup: SemanticSignal
    isMemeLike: SemanticSignal
  }
  quality: {
    blur: BlurLevel
    isSolidColor: SemanticSignal
    informationSufficient: boolean
  }
  safety: {
    nudity: SemanticSignal
    sexual: SemanticSignal
    violence: SemanticSignal
    gore: SemanticSignal
  }
  visualMood: string[]
  usefulObjects: string[]
}

export type SafetyReasonCode = 'hate' | 'self-harm' | 'sexual' | 'violence' | 'nudity' | 'gore'

export type ThemeReasonCode = 'selfie' | 'product-photo' | 'meme-like' | 'pet-closeup'

export type InformationReasonCode =
  'solid-color' | 'severely-blurred' | 'unrecognizable-scene' | 'insufficient-information'

export type SystemReasonCode = 'analysis-unavailable'

export type ImageFeasibilityReason =
  | { category: 'safety'; code: SafetyReasonCode }
  | { category: 'theme'; code: ThemeReasonCode }
  | { category: 'information'; code: InformationReasonCode }
  | { category: 'system'; code: SystemReasonCode }

export interface ImageFeasibilityResult {
  decision: 'accept' | 'reject'
  reasons: ImageFeasibilityReason[]
}

export interface ImageFeasibilityInput {
  contentSafety: ContentSafetyAssessment | null
  semanticAnalysis: ImageSemanticAnalysis | null
}
