import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageSemanticAnalysis } from '../../shared/types/image-feasibility'
import type { AnalyzeSemantics, ProviderImageInput } from '../../server/providers/provider.types'
import { createGeminiSemanticProvider } from '../../server/providers/gemini'
import { imageSemanticAnalysisJsonSchema } from '../../shared/schemas/image-semantic-analysis'

const { generateContentMock, GoogleGenAIMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
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
  generateContentMock.mockReset()
  GoogleGenAIMock.mockReset()
  GoogleGenAIMock.mockImplementation(function () {
    return {
      models: { generateContent: generateContentMock }
    }
  })

  analyzeImageSemantics = createGeminiSemanticProvider({
    apiKey: 'test-gemini-key',
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
    generateContentMock.mockResolvedValue({ text: JSON.stringify(semanticAnalysis) })

    const result = await analyzeImageSemantics(input)

    expect(result).toEqual(semanticAnalysis)
    expect(GoogleGenAIMock).toHaveBeenCalledWith({ apiKey: 'test-gemini-key' })
    expect(generateContentMock).toHaveBeenCalledWith({
      model: 'gemini-3.7-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: Buffer.from(input.bytes).toString('base64')
          }
        },
        { text: expect.any(String) }
      ],
      config: {
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseJsonSchema: imageSemanticAnalysisJsonSchema
      }
    })
  })

  it('rejects invalid JSON as a malformed provider response', async () => {
    generateContentMock.mockResolvedValue({ text: '{invalid-json' })

    await expect(analyzeImageSemantics(input)).rejects.toEqual({
      provider: 'gemini',
      code: 'schema-validation-failed'
    })
  })

  it('rejects JSON that does not match the semantic schema', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        ...semanticAnalysis,
        quality: { ...semanticAnalysis.quality, blur: 'crisp' }
      })
    })

    await expect(analyzeImageSemantics(input)).rejects.toEqual({
      provider: 'gemini',
      code: 'schema-validation-failed'
    })
  })

  it('rejects missing Gemini configuration before creating the client', async () => {
    const missingConfigProvider = createGeminiSemanticProvider({ apiKey: '', model: '' })

    await expect(missingConfigProvider(input)).rejects.toEqual({
      provider: 'gemini',
      code: 'missing-configuration'
    })
    expect(GoogleGenAIMock).not.toHaveBeenCalled()
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
    generateContentMock.mockRejectedValueOnce(sdkError)

    await expect(analyzeImageSemantics(input)).rejects.toMatchObject({
      name: 'GeminiRequestError',
      provider: 'gemini',
      statusCode: 404,
      providerCode: 'NOT_FOUND',
      sdkResponse: sdkError
    })
  })
})
