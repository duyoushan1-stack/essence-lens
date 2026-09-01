import { describe, expect, it } from 'vitest'
import type {
  ContentSafetyAssessment,
  ImageSemanticAnalysis
} from '../../shared/types/image-feasibility'
import { evaluateImageFeasibility } from '../../server/utils/image-feasibility-policy'

const safeContentSafety: ContentSafetyAssessment = {
  provider: 'azure-content-safety',
  apiVersion: '2024-09-01',
  categories: {
    hate: 0,
    'self-harm': 0,
    sexual: 0,
    violence: 0
  }
}

const clearSemanticAnalysis: ImageSemanticAnalysis = {
  schemaVersion: 'image-semantic-analysis-v1',
  scene: {
    category: 'outdoor',
    recognizable: true
  },
  subjects: {
    peopleCount: 0,
    isSelfie: 'absent',
    hasProductFocus: 'absent',
    hasPetCloseup: 'absent',
    isMemeLike: 'absent'
  },
  quality: {
    blur: 'none',
    isSolidColor: 'absent',
    informationSufficient: true
  },
  safety: {
    nudity: 'absent',
    sexual: 'absent',
    violence: 'absent',
    gore: 'absent'
  },
  visualMood: ['calm'],
  usefulObjects: ['trees']
}

describe('evaluateImageFeasibility', () => {
  it('accepts a safe image with a recognizable scene', () => {
    const result = evaluateImageFeasibility({
      contentSafety: safeContentSafety,
      semanticAnalysis: clearSemanticAnalysis
    })

    expect(result).toEqual({ decision: 'accept', reasons: [] })
  })

  it('rejects Azure safety findings without requiring semantic analysis', () => {
    const result = evaluateImageFeasibility({
      contentSafety: {
        ...safeContentSafety,
        categories: { ...safeContentSafety.categories, sexual: 2 }
      },
      semanticAnalysis: null
    })

    expect(result).toEqual({
      decision: 'reject',
      reasons: [{ category: 'safety', code: 'sexual' }]
    })
  })

  it('groups multiple reasons by category and keeps a stable order', () => {
    const result = evaluateImageFeasibility({
      contentSafety: safeContentSafety,
      semanticAnalysis: {
        ...clearSemanticAnalysis,
        subjects: {
          ...clearSemanticAnalysis.subjects,
          isSelfie: 'present',
          hasProductFocus: 'present'
        },
        quality: {
          ...clearSemanticAnalysis.quality,
          blur: 'severe'
        }
      }
    })

    expect(result).toEqual({
      decision: 'reject',
      reasons: [
        { category: 'theme', code: 'selfie' },
        { category: 'theme', code: 'product-photo' },
        { category: 'information', code: 'severely-blurred' }
      ]
    })
  })

  it('rejects unknown critical signals as analysis unavailable', () => {
    const result = evaluateImageFeasibility({
      contentSafety: safeContentSafety,
      semanticAnalysis: {
        ...clearSemanticAnalysis,
        subjects: {
          ...clearSemanticAnalysis.subjects,
          isSelfie: 'unknown'
        }
      }
    })

    expect(result).toEqual({
      decision: 'reject',
      reasons: [{ category: 'system', code: 'analysis-unavailable' }]
    })
  })
})
