import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageSemanticAnalysis } from '../../shared/types/image-feasibility'
import type { AnalyzeSemantics, ProviderImageInput } from '../../server/providers/provider.types'
import {
  createGeminiAnalysisProvider,
  createGeminiClient
} from '../../server/providers/gemini/index'
import { imageSemanticAnalysisJsonSchema } from '../../shared/schemas/image-semantic-analysis'

const { interactionsCreateMock, GoogleGenAIMock } = vi.hoisted(() => ({
  interactionsCreateMock: vi.fn(),
  GoogleGenAIMock: vi.fn()
}))

vi.mock('@google/genai', () => ({ GoogleGenAI: GoogleGenAIMock }))

let analyzeImageSemantics: AnalyzeSemantics

const input: ProviderImageInput = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: 'image/jpeg',
  filename: 'sample.jpg'
}

const semanticAnalysis: ImageSemanticAnalysis = {
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
  safety: {
    nudity: 'absent',
    sexual: 'absent',
    violence: 'absent',
    gore: 'absent'
  },
  visualMood: ['calm'],
  usefulObjects: ['trees']
}

beforeEach(() => {
  interactionsCreateMock.mockReset()
  GoogleGenAIMock.mockReset()
  GoogleGenAIMock.mockImplementation(function () {
    return {
      interactions: { create: interactionsCreateMock }
    }
  })

  analyzeImageSemantics = createGeminiAnalysisProvider({
    client: createGeminiClient('test-gemini-key'),
    model: 'gemini-3.7-flash'
  })
})

describe('analyzeImageSemantics', () => {
  it('emits Gemini-compatible JSON Schema from the canonical Zod schema', () => {
    expect(imageSemanticAnalysisJsonSchema).toMatchObject({
      type: 'object',
      properties: {
        schemaVersion: {
          type: 'string',
          enum: ['image-semantic-analysis-v1']
        },
        subjects: {
          properties: {
            peopleCount: {
              type: ['integer', 'null'],
              minimum: 0
            }
          }
        }
      }
    })
    expect(imageSemanticAnalysisJsonSchema).not.toHaveProperty('$schema')
    expect(imageSemanticAnalysisJsonSchema).not.toHaveProperty('properties.schemaVersion.const')
    expect(imageSemanticAnalysisJsonSchema).not.toHaveProperty(
      'properties.subjects.properties.peopleCount.anyOf'
    )
  })

  it('sends inline image data with structured JSON output and parses the response', async () => {
    interactionsCreateMock.mockResolvedValue({ output_text: JSON.stringify(semanticAnalysis) })

    const result = await analyzeImageSemantics(input)

    expect(result).toEqual(semanticAnalysis)
    expect(GoogleGenAIMock).toHaveBeenCalledWith({ apiKey: 'test-gemini-key' })
    expect(interactionsCreateMock).toHaveBeenCalledWith({
      model: 'gemini-3.7-flash',
      input: [
        {
          type: 'image',
          mime_type: 'image/jpeg',
          data: Buffer.from(input.bytes).toString('base64')
        },
        {
          type: 'text',
          text: expect.any(String)
        }
      ],
      generation_config: {
        max_output_tokens: 1024
      },
      response_format: [
        {
          type: 'text',
          mime_type: 'application/json',
          schema: imageSemanticAnalysisJsonSchema
        }
      ]
    })
  })

  it('rejects invalid JSON as a malformed provider response', async () => {
    interactionsCreateMock.mockResolvedValue({ output_text: '{invalid-json' })

    await expect(analyzeImageSemantics(input)).rejects.toEqual({
      provider: 'gemini',
      code: 'schema-validation-failed',
      stage: 'semantic-analysis'
    })
  })

  it('rejects JSON that does not match the semantic schema', async () => {
    interactionsCreateMock.mockResolvedValue({
      output_text: JSON.stringify({
        ...semanticAnalysis,
        quality: { ...semanticAnalysis.quality, blur: 'crisp' }
      })
    })

    await expect(analyzeImageSemantics(input)).rejects.toEqual({
      provider: 'gemini',
      code: 'schema-validation-failed',
      stage: 'semantic-analysis',
      validationIssues: [
        {
          path: 'quality.blur',
          code: 'invalid_value'
        }
      ]
    })
  })

  it('rejects missing Gemini configuration before creating the client', async () => {
    const missingConfigProvider = createGeminiAnalysisProvider({ client: null, model: '' })

    await expect(missingConfigProvider(input)).rejects.toEqual({
      provider: 'gemini',
      code: 'missing-configuration'
    })
    expect(GoogleGenAIMock).toHaveBeenCalledTimes(1)
  })

  it('preserves the SDK error response while exposing safe provider diagnostics', async () => {
    const sdkError = {
      status: 404,
      message: JSON.stringify({
        error: {
          code: 404,
          status: 'NOT_FOUND',
          message: 'Model was not found'
        }
      })
    }
    interactionsCreateMock.mockRejectedValueOnce(sdkError)

    await expect(analyzeImageSemantics(input)).rejects.toMatchObject({
      name: 'GeminiRequestError',
      provider: 'gemini',
      statusCode: 404,
      providerCode: 'NOT_FOUND',
      sdkResponse: sdkError
    })
  })

  it('unwraps the nested Interactions API error payload for rate limits', async () => {
    const sdkError = {
      status: 429,
      statusCode: 429,
      error: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'Rate limit exceeded'
        }
      },
      body: JSON.stringify({
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'Rate limit exceeded'
        }
      })
    }
    interactionsCreateMock.mockRejectedValueOnce(sdkError)

    await expect(analyzeImageSemantics(input)).rejects.toMatchObject({
      name: 'GeminiRequestError',
      provider: 'gemini',
      statusCode: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      sdkResponse: sdkError
    })
  })
})
