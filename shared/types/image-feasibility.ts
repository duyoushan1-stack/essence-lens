import type { ImageSemanticAnalysis } from '../schemas/image-semantic-analysis'

export type { ImageSemanticAnalysis }

export type ContentSafetySeverity = 0 | 2 | 4 | 6

export type ContentSafetyCategory = 'hate' | 'self-harm' | 'sexual' | 'violence'

export interface ContentSafetyAssessment {
  provider: 'azure-content-safety'
  categories: Record<ContentSafetyCategory, ContentSafetySeverity>
}

export type SemanticSignal = ImageSemanticAnalysis['subjects']['isSelfie']

export type BlurLevel = ImageSemanticAnalysis['quality']['blur']

export type SceneCategory = ImageSemanticAnalysis['scene']['category']

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
