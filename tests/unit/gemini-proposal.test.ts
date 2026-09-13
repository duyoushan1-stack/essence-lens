import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProposalGenerationContext } from '../../server/providers/provider.types'
import { createGeminiClient } from '../../server/providers/gemini/client'
import { createGeminiProposalProvider } from '../../server/providers/gemini/proposal'
import { proposalDraftJsonSchema } from '../../server/providers/gemini/schemas/proposal-draft.schema'

const { interactionsCreateMock, GoogleGenAIMock } = vi.hoisted(() => ({
  interactionsCreateMock: vi.fn(),
  GoogleGenAIMock: vi.fn()
}))

vi.mock('@google/genai', () => ({ GoogleGenAI: GoogleGenAIMock }))

const context: ProposalGenerationContext = {
  analysis: {
    scene: { category: 'outdoor', recognizable: true },
    subjects: {
      peopleCount: 0,
      isSelfie: 'absent',
      hasProductFocus: 'absent',
      hasPetCloseup: 'absent',
      isMemeLike: 'absent'
    },
    visualMood: ['calm', 'curious'],
    usefulObjects: ['trees', 'street']
  },
  locations: [{ name: '大安森林公園', sourceUrl: 'https://maps.google.com/maps?cid=1', reason: 'Trees', suggestedActivities: ['Walk along the park paths'] }],
  locale: 'zh-TW'
}

const draft = {
  locationCandidate: '大安森林公園',
  title: '午後散步與咖啡',
  summary: '沿著有樹影的街區慢慢走，再找一間安靜的咖啡店休息。',
  perspective: 'nature',
  itinerary: {
    morning: { title: '公園散步', description: '在樹影間放慢腳步。' },
    noon: { title: '街區午餐', description: '找一間在地小店用餐。' },
    afternoon: { title: '咖啡與閱讀', description: '選一個靠窗的位置休息。' }
  },
  cover: { imagePrompt: 'A calm tree-lined urban afternoon, editorial travel photography.' }
}

describe('createGeminiProposalProvider', () => {
  beforeEach(() => {
    interactionsCreateMock.mockReset()
    GoogleGenAIMock.mockReset()
    GoogleGenAIMock.mockImplementation(function () {
      return { interactions: { create: interactionsCreateMock } }
    })
  })

  it('requests exactly three structured Proposal drafts', async () => {
    interactionsCreateMock.mockResolvedValue({ output_text: JSON.stringify([draft, draft, draft]) })

    const generateProposal = createGeminiProposalProvider({
      client: createGeminiClient('test-gemini-key'),
      model: 'gemini-proposal'
    })

    await expect(generateProposal(context)).resolves.toEqual([draft, draft, draft])
    expect(interactionsCreateMock).toHaveBeenCalledWith({
      model: 'gemini-proposal',
      input: [{ type: 'text', text: expect.any(String) }],
      generation_config: { max_output_tokens: 4096 },
      response_format: [
        {
          type: 'text',
          mime_type: 'application/json',
          schema: proposalDraftJsonSchema
        }
      ]
    })
  })

  it('rejects invalid JSON and output beyond three cards', async () => {
    interactionsCreateMock.mockResolvedValue({ output_text: '{invalid-json' })

    const generateProposal = createGeminiProposalProvider({
      client: createGeminiClient('test-gemini-key'),
      model: 'gemini-proposal'
    })

    await expect(generateProposal(context)).rejects.toEqual({
      provider: 'gemini',
      code: 'schema-validation-failed',
      stage: 'proposal-generation'
    })

    interactionsCreateMock.mockResolvedValue({
      output_text: JSON.stringify([draft, draft, draft, draft])
    })

    await expect(generateProposal(context)).rejects.toEqual({
      provider: 'gemini',
      code: 'schema-validation-failed',
      stage: 'proposal-generation',
      validationIssues: [{ path: '$', code: 'too_big' }]
    })
  })

  it.each([1, 2])('rejects an incomplete response with %i cards', async (count) => {
    interactionsCreateMock.mockResolvedValue({ output_text: JSON.stringify(Array.from({ length: count }, () => draft)) })
    const provider = createGeminiProposalProvider({ client: createGeminiClient('test-gemini-key'), model: 'gemini-proposal' })
    await expect(provider(context)).rejects.toMatchObject({ stage: 'proposal-generation', code: 'schema-validation-failed' })
  })

  it('does not call the model without grounded destinations', async () => {
    const provider = createGeminiProposalProvider({ client: createGeminiClient('test-gemini-key'), model: 'gemini-proposal' })
    await expect(provider({ ...context, locations: [] })).rejects.toMatchObject({ stage: 'grounding' })
    expect(interactionsCreateMock).not.toHaveBeenCalled()
  })

  it('rejects activity titles without executable descriptions', async () => {
    interactionsCreateMock.mockResolvedValue({ output_text: JSON.stringify(Array.from({ length: 3 }, () => ({
      ...draft, itinerary: { ...draft.itinerary, morning: { title: '建築立面攝影' } }
    }))) })
    const provider = createGeminiProposalProvider({ client: createGeminiClient('test-gemini-key'), model: 'gemini-proposal' })
    await expect(provider(context)).rejects.toMatchObject({ stage: 'proposal-generation', code: 'schema-validation-failed' })
  })
})
