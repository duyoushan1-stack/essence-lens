import { beforeAll, describe, expect, it, vi } from 'vitest'
import type {
  ImageSemanticAnalysis,
  ContentSafetyAssessment
} from '../../shared/types/image-feasibility'
import type { ProposalDraft, ProposalProviderDependencies, ProviderImageInput } from '../../server/providers/provider.types'

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

const locations = [{ name: '大安森林公園', address: '台北市大安區新生南路二段 1 號', sourceUrl: 'https://maps.google.com/maps?cid=1', reason: 'Trees', suggestedActivities: ['Walk along the park paths'] }]

const drafts: ProposalDraft[] = ([
  {
    title: '午後散步與咖啡',
    summary: '到附近街區散步，再找一間安靜的咖啡店休息。',
    perspective: 'nature',
    itinerary: {
      morning: { title: '公園散步' },
      noon: { title: '街區午餐' },
      afternoon: { title: '咖啡與閱讀' }
    },
    cover: { imagePrompt: 'A calm urban afternoon.' }
  },
  {
    title: '沿街慢慢走',
    summary: '沿著熟悉的街區走一小段，留意平常忽略的細節。',
    perspective: 'coast',
    itinerary: {
      morning: { title: '街角觀察' },
      noon: { title: '簡單午餐' },
      afternoon: { title: '黃昏慢行' }
    },
    cover: { imagePrompt: 'A quiet neighborhood walk.' }
  },
  {
    title: '黃昏取景',
    summary: '在日落前找一個安靜的位置，替今天留下畫面。',
    perspective: 'culture',
    itinerary: {
      morning: { title: '選一條路線' },
      noon: { title: '慢慢吃飯' },
      afternoon: { title: '等待夕陽' }
    },
    cover: { imagePrompt: 'A peaceful neighborhood at golden hour.' }
  }
] satisfies ProposalDraft[]).map((draft) => ({
  ...draft,
  locationCandidate: '大安森林公園',
  itinerary: {
    morning: { ...draft.itinerary.morning, description: '沿公園步道步行，觀察路旁樹木。' },
    noon: { ...draft.itinerary.noon, description: '在公園步道觀察樹葉形狀與枝幹。' },
    afternoon: { ...draft.itinerary.afternoon, description: '在公園拍攝樹木與步道的構圖。' }
  }
}))

const createDependencies = (
  analyzeSafety: ReturnType<typeof vi.fn>,
  analyzeSemantics: ReturnType<typeof vi.fn>,
  generateProposal: ReturnType<typeof vi.fn>,
  overrides: Pick<ProposalProviderDependencies, 'groundLocations' | 'generateProposalImage'> = {}
): ProposalProviderDependencies => ({
  analyzeSafety,
  analyzeSemantics,
  groundLocations: overrides.groundLocations ?? vi.fn().mockResolvedValue(locations),
  generateProposal,
  generateProposalImage: overrides.generateProposalImage ?? vi.fn().mockResolvedValue(null)
})

describe('createProposalService', () => {
  it('stops before generating cards when grounding returns no destinations', async () => {
    const generateProposal = vi.fn().mockResolvedValue(drafts)
    const service = createProposalService(createDependencies(
      vi.fn().mockResolvedValue(safety), vi.fn().mockResolvedValue(semantics), generateProposal,
      { groundLocations: vi.fn().mockResolvedValue([]) }
    ))
    const result = await service.generate({ file: input, idempotencyKey: 'no-destinations', debug: true })
    expect(result).toMatchObject({ status: 'error', debug: { provider: { stage: 'grounding' } } })
    expect(generateProposal).not.toHaveBeenCalled()
  })

  it('rejects an incomplete one-card response', async () => {
    const service = createProposalService(createDependencies(
      vi.fn().mockResolvedValue(safety), vi.fn().mockResolvedValue(semantics),
      vi.fn().mockResolvedValue([drafts[0]])
    ))
    expect(await service.generate({ file: input, idempotencyKey: 'one-card' })).toMatchObject({ status: 'error' })
  })

  it('rejects a destination that does not match grounding before generating covers', async () => {
    const generateProposalImage = vi.fn()
    const service = createProposalService(createDependencies(
      vi.fn().mockResolvedValue(safety), vi.fn().mockResolvedValue(semantics),
      vi.fn().mockResolvedValue(drafts.map(draft => ({ ...draft, locationCandidate: '未驗證地點' }))),
      { generateProposalImage }
    ))
    const result = await service.generate({ file: input, idempotencyKey: 'unmatched-destination', debug: true })
    expect(result).toMatchObject({ status: 'error', debug: { provider: { stage: 'proposal-generation' } } })
    expect(generateProposalImage).not.toHaveBeenCalled()
  })
  it('accepts multiple culture proposals without forcing unrelated settings', async () => {
    const service = createProposalService(createDependencies(
      vi.fn().mockResolvedValue(safety),
      vi.fn().mockResolvedValue(semantics),
      vi.fn().mockResolvedValue(drafts.map((draft) => ({ ...draft, perspective: 'culture' })))
    ))
    const result = await service.generate({ file: input, idempotencyKey: 'shared-culture' })
    expect(result.status).toBe('success')
  })

  it('runs the mock pipeline and returns a proposal', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const generateProposal = vi.fn().mockResolvedValue(drafts)
    const service = createProposalService(createDependencies(analyzeSafety, analyzeSemantics, generateProposal))

    const result = await service.generate({ file: input, idempotencyKey: 'key-1' })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.proposals).toHaveLength(3)
      expect(result.proposals[0]).toMatchObject({
        title: drafts[0]?.title,
        summary: drafts[0]?.summary,
        cover: { imagePrompt: drafts[0]?.cover.imagePrompt, status: 'unavailable' }
      })
    }
    expect(generateProposal).toHaveBeenCalledOnce()
  })

  it('does not generate a proposal after feasibility rejection', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue({
      ...safety,
      categories: { ...safety.categories, violence: 4 }
    })
    const analyzeSemantics = vi.fn()
    const generateProposal = vi.fn()
    const service = createProposalService(createDependencies(analyzeSafety, analyzeSemantics, generateProposal))

    const result = await service.generate({ file: input, idempotencyKey: 'key-2' })

    expect(result).toEqual({
      status: 'rejected',
      reasons: [{ category: 'safety', code: 'violence' }]
    })
    expect(generateProposal).not.toHaveBeenCalled()
  })

  it('maps only matched grounded locations to a deterministic Maps URL', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const groundLocations = vi.fn().mockResolvedValue([
      {
        name: '大安森林公園',
        address: '台北市大安區新生南路二段 1 號',
        sourceUrl: 'https://example.com/location',
        reason: '符合樹影與街區散步氛圍'
      }
    ])
    const generateProposal = vi.fn().mockResolvedValue(drafts)
    const service = createProposalService(
      createDependencies(analyzeSafety, analyzeSemantics, generateProposal, { groundLocations })
    )

    const result = await service.generate({ file: input, idempotencyKey: 'key-location' })

    expect(groundLocations).toHaveBeenCalledWith({
      analysis: {
        scene: semantics.scene,
        subjects: semantics.subjects,
        visualMood: semantics.visualMood,
        usefulObjects: semantics.usefulObjects
      },
      locale: 'zh-TW'
    })
    expect(generateProposal).toHaveBeenCalledWith({
      analysis: expect.any(Object),
      locations: expect.arrayContaining([expect.objectContaining({ name: '大安森林公園' })]),
      locale: 'zh-TW'
    })
    expect(result).toMatchObject({
      status: 'success',
      proposals: expect.arrayContaining([
        expect.objectContaining({
          location: expect.objectContaining({
            name: '大安森林公園',
            externalUrl:
              'https://www.google.com/maps/search/?api=1&query=%E5%A4%A7%E5%AE%89%E6%A3%AE%E6%9E%97%E5%85%AC%E5%9C%92%2C%20%E5%8F%B0%E5%8C%97%E5%B8%82%E5%A4%A7%E5%AE%89%E5%8D%80%E6%96%B0%E7%94%9F%E5%8D%97%E8%B7%AF%E4%BA%8C%E6%AE%B5%201%20%E8%99%9F'
          })
        })
      ])
    })
  })

  it('reports grounding failure instead of returning location-free cards', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const groundLocations = vi.fn().mockRejectedValue(new Error('grounding unavailable'))
    const generateProposal = vi.fn().mockResolvedValue([drafts[0]])
    const service = createProposalService(
      createDependencies(analyzeSafety, analyzeSemantics, generateProposal, { groundLocations })
    )

    const result = await service.generate({
      file: input,
      idempotencyKey: 'key-grounding-degradation',
      debug: true
    })

    expect(result).toMatchObject({
      status: 'error',
      debug: { provider: { provider: 'gemini', stage: 'grounding' } }
    })
    expect(generateProposal).not.toHaveBeenCalled()
  })

  it('preserves a verified Google Maps source URL for the location link', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const mapsUrl = 'https://www.google.com/maps/place/%E5%A4%A7%E5%AE%89%E6%A3%AE%E6%9E%97%E5%85%AC%E5%9C%92'
    const groundLocations = vi.fn().mockResolvedValue([
      {
        name: '大安森林公園',
        sourceUrl: mapsUrl,
        reason: '符合樹影與街區散步氛圍'
      }
    ])
    const generateProposal = vi.fn().mockResolvedValue(drafts)
    const service = createProposalService(
      createDependencies(analyzeSafety, analyzeSemantics, generateProposal, { groundLocations })
    )

    const result = await service.generate({ file: input, idempotencyKey: 'key-maps-url' })

    expect(result).toMatchObject({
      status: 'success',
      proposals: expect.arrayContaining([expect.objectContaining({ location: expect.objectContaining({ externalUrl: mapsUrl }) })])
    })
  })

  it('keeps text proposals when one cover generation fails', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const generateProposal = vi.fn().mockResolvedValue(drafts)
    const generateProposalImage = vi
      .fn()
      .mockRejectedValueOnce(new Error('cover unavailable'))
      .mockResolvedValue(null)
    const service = createProposalService(
      createDependencies(analyzeSafety, analyzeSemantics, generateProposal, {
        generateProposalImage
      })
    )

    const result = await service.generate({ file: input, idempotencyKey: 'key-cover' })

    expect(result).toMatchObject({
      status: 'success',
      proposals: [
        { title: drafts[0]?.title, cover: { status: 'failed' } },
        { title: drafts[1]?.title, cover: { status: 'unavailable' } },
        { title: drafts[2]?.title, cover: { status: 'unavailable' } }
      ]
    })
  })

  it('keeps safe Gemini provider debug data for proposal generation failures', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const generateProposal = vi.fn().mockRejectedValue({
      status: 503,
      provider: 'gemini',
      providerCode: 'ServiceUnavailable'
    })
    const service = createProposalService(createDependencies(analyzeSafety, analyzeSemantics, generateProposal))

    const result = await service.generate({
      file: input,
      idempotencyKey: 'key-gemini-error',
      debug: true
    })

    expect(result).toEqual({
      status: 'error',
      code: 'provider-unavailable',
      debug: {
        semanticAnalysis: semantics,
        provider: {
          provider: 'gemini',
          statusCode: 503,
          providerCode: 'ServiceUnavailable'
        }
      }
    })
  })

  it('keeps proposal generation stage and validation paths in debug data', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const generateProposal = vi.fn().mockRejectedValue({
      provider: 'gemini',
      code: 'schema-validation-failed',
      stage: 'proposal-generation',
      validationIssues: [{ path: '[0].perspective', code: 'invalid_value' }]
    })
    const service = createProposalService(createDependencies(analyzeSafety, analyzeSemantics, generateProposal))

    const result = await service.generate({
      file: input,
      idempotencyKey: 'key-gemini-schema-error',
      debug: true
    })

    expect(result).toEqual({
      status: 'error',
      code: 'malformed-provider-response',
      debug: {
        semanticAnalysis: semantics,
        provider: {
          provider: 'gemini',
          providerCode: 'schema-validation-failed',
          stage: 'proposal-generation',
          validationIssues: [{ path: '[0].perspective', code: 'invalid_value' }]
        }
      }
    })
  })

  it('returns semantic debug data without caching the debug result', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const generateProposal = vi.fn().mockResolvedValue(drafts)
    const service = createProposalService(createDependencies(analyzeSafety, analyzeSemantics, generateProposal))

    const debugResult = await service.generate({
      file: input,
      idempotencyKey: 'key-debug',
      debug: true
    })
    const normalResult = await service.generate({ file: input, idempotencyKey: 'key-debug' })

    expect(debugResult.status).toBe('success')
    expect(normalResult.status).toBe('success')
    if (debugResult.status === 'success' && normalResult.status === 'success') {
      expect(debugResult.proposals).toHaveLength(3)
      expect(normalResult.proposals).toHaveLength(3)
      expect(debugResult.debug).toEqual({ semanticAnalysis: semantics })
    }
    expect(analyzeSemantics).toHaveBeenCalledTimes(2)
    expect(generateProposal).toHaveBeenCalledTimes(2)
  })

  it('replays the outcome for the same key and rejects a different payload', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safety)
    const analyzeSemantics = vi.fn().mockResolvedValue(semantics)
    const generateProposal = vi.fn().mockResolvedValue(drafts)
    const service = createProposalService(createDependencies(analyzeSafety, analyzeSemantics, generateProposal))

    const first = await service.generate({ file: input, idempotencyKey: 'key-3' })
    const duplicate = await service.generate({ file: input, idempotencyKey: 'key-3' })
    const conflict = await service.generate({
      file: { ...input, bytes: new Uint8Array([4, 5, 6]) },
      idempotencyKey: 'key-3'
    })

    expect(first.status).toBe('success')
    expect(duplicate).toEqual(first)
    expect(conflict).toEqual({ status: 'conflict' })
    expect(generateProposal).toHaveBeenCalledOnce()
  })
})
