import { beforeAll, describe, expect, it, vi } from 'vitest'
import type {
  ImageSemanticAnalysis,
  ContentSafetyAssessment
} from '../../shared/types/image-feasibility'
import type { Proposal } from '../../shared/types/proposal'
import type { ProviderImageInput } from '../../server/providers/provider.types'

type ProposalServiceModule = typeof import('../../server/services/proposal.service')
let createProposalService: ProposalServiceModule['createProposalService']

beforeAll(async () => {
  vi.stubGlobal(
    'defineCachedFunction',
    <TInput extends { idempotencyKey: string }, TResult>(
      fn: (input: TInput) => Promise<TResult>,
      options: { getKey: (input: TInput) => string | Promise<string> }
    ) => {
      const cache = new Map<string, TResult>()

      return async (input: TInput): Promise<TResult> => {
        const key = await options.getKey(input)
        const existing = cache.get(key)

        if (existing) {
          return existing
        }

        const result = await fn(input)
        cache.set(key, result)
        return result
      }
    }
  )

  const serviceModule = await import('../../server/services/proposal.service')
  createProposalService = serviceModule.createProposalService
})

const input: ProviderImageInput = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: 'image/jpeg',
  filename: 'sample.jpg'
}

const safety: ContentSafetyAssessment = {
  provider: 'azure-content-safety',
  apiVersion: '2024-09-01',
  categories: { hate: 0, 'self-harm': 0, sexual: 0, violence: 0 }
}

const semantics: ImageSemanticAnalysis = {
  schemaVersion: 'image-semantic-analysis-v1',
  scene: { category: 'outdoor', recognizable: true },
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
  safety: { nudity: 'absent', sexual: 'absent', violence: 'absent', gore: 'absent' },
  visualMood: ['calm'],
  usefulObjects: ['trees']
}

const proposals: Proposal[] = [
  {
    title: '午後散步與咖啡',
    description: '到附近街區散步，再找一間安靜的咖啡店休息。'
  },
  {
    title: '沿街慢慢走',
    description: '沿著熟悉的街區走一小段，留意平常忽略的細節。'
  },
  {
    title: '黃昏取景',
    description: '在日落前找一個安靜的位置，替今天留下畫面。'
  }
]

describe('createProposalService', () => {
  it('runs the mock pipeline and returns a proposal', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const generateProposal = vi.fn().mockResolvedValue(proposals)
    const service = createProposalService({ analyzeSafety, analyzeSemantics, generateProposal })

    const result = await service.generate({ file: input, idempotencyKey: 'key-1' })

    expect(result).toEqual({ status: 'success', proposals })
    expect(generateProposal).toHaveBeenCalledOnce()
  })

  it('does not generate a proposal after feasibility rejection', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue({
      ...safety,
      categories: { ...safety.categories, violence: 4 }
    })
    const analyzeSemantics = vi.fn()
    const generateProposal = vi.fn()
    const service = createProposalService({ analyzeSafety, analyzeSemantics, generateProposal })

    const result = await service.generate({ file: input, idempotencyKey: 'key-2' })

    expect(result).toEqual({
      status: 'rejected',
      reasons: [{ category: 'safety', code: 'violence' }]
    })
    expect(generateProposal).not.toHaveBeenCalled()
  })

  it('replays the outcome for the same key and rejects a different payload', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const generateProposal = vi.fn().mockResolvedValue(proposals)
    const service = createProposalService({ analyzeSafety, analyzeSemantics, generateProposal })

    const first = await service.generate({ file: input, idempotencyKey: 'key-3' })
    const duplicate = await service.generate({ file: input, idempotencyKey: 'key-3' })
    const conflict = await service.generate({
      file: { ...input, bytes: new Uint8Array([4, 5, 6]) },
      idempotencyKey: 'key-3'
    })

    expect(first).toEqual({ status: 'success', proposals })
    expect(duplicate).toEqual(first)
    expect(conflict).toEqual({ status: 'conflict' })
    expect(generateProposal).toHaveBeenCalledOnce()
  })
})
