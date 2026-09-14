import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProposalContext } from '../../shared/types/proposal'
import { createGeminiClient } from '../../server/providers/gemini/client'
import { createGeminiGroundingProvider } from '../../server/providers/gemini/grounding'

const { interactionsCreateMock, GoogleGenAIMock } = vi.hoisted(() => ({
  interactionsCreateMock: vi.fn(),
  GoogleGenAIMock: vi.fn()
}))

vi.mock('@google/genai', () => ({ GoogleGenAI: GoogleGenAIMock }))

const context: ProposalContext = {
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
}

describe('createGeminiGroundingProvider', () => {
  it('reads Maps tool places when structured model output has no annotations', async () => {
    interactionsCreateMock.mockResolvedValue({
      output_text: JSON.stringify([
        {
          name: 'Sanxia Old Street',
          displayName: '三峽老街',
          address: 'Minquan St, Sanxia, Taiwan',
          reason: '磚拱騎樓',
          suggestedActivities: ['拍攝磚拱騎樓']
        }
      ]),
      steps: [
        {
          type: 'google_maps_result',
          result: [
            {
              places: [
                {
                  place_id: 'place-1',
                  name: 'Review of Sanxia Old Street - Google Maps',
                  url: 'https://www.google.com/maps/reviews/review-1'
                },
                {
                  place_id: 'place-1',
                  name: 'Sanxia Old Street - Google Maps',
                  url: 'https://maps.google.com/maps?cid=240'
                }
              ]
            }
          ]
        },
        { type: 'model_output', content: [{ type: 'text', text: 'structured JSON' }] }
      ]
    })
    const provider = createGeminiGroundingProvider({
      client: createGeminiClient('test-gemini-key'),
      model: 'gemini-grounding'
    })
    await expect(provider({ analysis: context, locale: 'zh-TW' })).resolves.toEqual([
      {
        name: 'Sanxia Old Street',
        displayName: '三峽老街',
        address: 'Minquan St, Sanxia, Taiwan',
        reason: '磚拱騎樓',
        suggestedActivities: ['拍攝磚拱騎樓'],
        sourceUrl: 'https://maps.google.com/maps?cid=240'
      }
    ])
  })
  beforeEach(() => {
    interactionsCreateMock.mockReset()
    GoogleGenAIMock.mockReset()
    GoogleGenAIMock.mockImplementation(function () {
      return { interactions: { create: interactionsCreateMock } }
    })
  })

  it('uses Google Maps grounding and keeps verified place citations', async () => {
    interactionsCreateMock.mockResolvedValue({
      output_text: JSON.stringify([
        {
          name: '大安森林公園',
          displayName: '大安森林公園',
          address: '台北市大安區新生南路二段 1 號',
          reason: '適合在樹影中放慢腳步。',
          suggestedActivities: ['沿著公園步道散步']
        }
      ]),
      steps: [
        {
          type: 'model_output',
          content: [
            {
              type: 'text',
              text: '大安森林公園適合這個週末方向。',
              annotations: [
                {
                  type: 'place_citation',
                  name: '大安森林公園',
                  url: 'https://www.google.com/maps/place/%E5%A4%A7%E5%AE%89%E6%A3%AE%E6%9E%97%E5%85%AC%E5%9C%92'
                }
              ]
            }
          ]
        }
      ]
    })

    const groundLocations = createGeminiGroundingProvider({
      client: createGeminiClient('test-gemini-key'),
      model: 'gemini-3.8-flash'
    })

    await expect(groundLocations({ analysis: context, locale: 'zh-TW' })).resolves.toEqual([
      {
        name: '大安森林公園',
        displayName: '大安森林公園',
        address: '台北市大安區新生南路二段 1 號',
        sourceUrl:
          'https://www.google.com/maps/place/%E5%A4%A7%E5%AE%89%E6%A3%AE%E6%9E%97%E5%85%AC%E5%9C%92',
        reason: '適合在樹影中放慢腳步。',
        suggestedActivities: ['沿著公園步道散步']
      }
    ])

    expect(interactionsCreateMock).toHaveBeenCalledWith({
      model: 'gemini-3.8-flash',
      input: [{ type: 'text', text: expect.stringContaining('Find up to three real places') }],
      tools: [{ type: 'google_maps' }],
      generation_config: { max_output_tokens: 2048 },
      response_format: [
        {
          type: 'text',
          mime_type: 'application/json',
          schema: expect.objectContaining({ type: 'array' })
        }
      ]
    })
  })

  it('returns a localized display name while preserving the canonical Maps name', async () => {
    interactionsCreateMock.mockResolvedValue({
      output_text: JSON.stringify([
        {
          name: 'Hakone Tozan Cable Car Sounzan Station',
          displayName: '箱根登山纜車早雲山站',
          reason: '可觀察山景與纜車站周邊景觀。',
          suggestedActivities: ['在觀景台眺望箱根山景。']
        }
      ]),
      steps: [
        {
          type: 'google_maps_result',
          result: [
            {
              places: [
                {
                  name: 'Hakone Tozan Cable Car Sounzan Station - Google Maps',
                  url: 'https://maps.google.com/maps?cid=hakone-1'
                }
              ]
            }
          ]
        }
      ]
    })

    const provider = createGeminiGroundingProvider({
      client: createGeminiClient('test-gemini-key'),
      model: 'gemini-grounding'
    })

    await expect(provider({ analysis: context, locale: 'zh-TW' })).resolves.toEqual([
      expect.objectContaining({
        name: 'Hakone Tozan Cable Car Sounzan Station',
        displayName: '箱根登山纜車早雲山站'
      })
    ])

    expect(interactionsCreateMock.mock.calls[0]?.[0].input[0].text).toEqual(
      expect.stringContaining('Traditional Chinese')
    )
  })

  it('drops grounded candidates without a Google Maps citation', async () => {
    interactionsCreateMock.mockResolvedValue({
      output_text: JSON.stringify([
        {
          name: '未驗證地點',
          displayName: '未驗證地點',
          reason: '不應直接顯示未驗證的地址。',
          suggestedActivities: ['沿著街道步行']
        }
      ]),
      steps: []
    })

    const groundLocations = createGeminiGroundingProvider({
      client: createGeminiClient('test-gemini-key'),
      model: 'gemini-3.8-flash'
    })

    await expect(groundLocations({ analysis: context, locale: 'zh-TW' })).resolves.toEqual([])
  })

  it('reports the grounding stage and Zod path for invalid output', async () => {
    interactionsCreateMock.mockResolvedValue({ output_text: JSON.stringify([]) })

    const groundLocations = createGeminiGroundingProvider({
      client: createGeminiClient('test-gemini-key'),
      model: 'gemini-3.8-flash'
    })

    await expect(groundLocations({ analysis: context, locale: 'zh-TW' })).rejects.toEqual({
      provider: 'gemini',
      code: 'schema-validation-failed',
      stage: 'grounding',
      validationIssues: [{ path: '$', code: 'too_small' }]
    })
  })

  it.each([undefined, [], [' '], ['one', 'two', 'three', 'four']])(
    'rejects missing, empty or excessive activity evidence: %j',
    async (suggestedActivities) => {
      interactionsCreateMock.mockResolvedValue({
        output_text: JSON.stringify([
          {
            name: '大溪老街',
            displayName: '大溪老街',
            reason: '歷史街屋立面',
            suggestedActivities
          }
        ])
      })
      const provider = createGeminiGroundingProvider({
        client: createGeminiClient('test-gemini-key'),
        model: 'gemini-grounding'
      })
      await expect(provider({ analysis: context, locale: 'zh-TW' })).rejects.toMatchObject({
        code: 'schema-validation-failed',
        stage: 'grounding'
      })
    }
  )

  it('does not attach another place citation to an unmatched destination', async () => {
    interactionsCreateMock.mockResolvedValue({
      output_text: JSON.stringify([
        {
          name: '大溪老街',
          displayName: '大溪老街',
          reason: '歷史街屋立面',
          suggestedActivities: ['拍攝歷史街屋立面']
        }
      ]),
      steps: [
        {
          type: 'model_output',
          content: [
            {
              type: 'text',
              annotations: [
                {
                  type: 'place_citation',
                  name: '象山',
                  url: 'https://www.google.com/maps/place/xiangshan'
                }
              ]
            }
          ]
        }
      ]
    })
    const provider = createGeminiGroundingProvider({
      client: createGeminiClient('test-gemini-key'),
      model: 'gemini-grounding'
    })
    await expect(provider({ analysis: context, locale: 'zh-TW' })).resolves.toEqual([])
  })
})
