import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderImageInput } from '../../server/providers/provider.types'
import { analyzeImageSafety } from '../../server/providers/azure-content-safety'

const { clientFactory, credentialFactory, isUnexpectedMock, pathMock, postMock } = vi.hoisted(
  () => ({
    clientFactory: vi.fn(),
    credentialFactory: vi.fn(),
    isUnexpectedMock: vi.fn(),
    pathMock: vi.fn(),
    postMock: vi.fn()
  })
)

vi.mock('@azure-rest/ai-content-safety', () => ({
  default: clientFactory,
  isUnexpected: isUnexpectedMock
}))

vi.mock('@azure/core-auth', () => ({
  AzureKeyCredential: class MockAzureKeyCredential {
    readonly key: string

    constructor(key: string) {
      this.key = key
      credentialFactory(key)
    }
  }
}))

const input: ProviderImageInput = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: 'image/jpeg',
  filename: 'sample.jpg'
}

describe('analyzeImageSafety', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      azureContentSafetyEndpoint: 'https://example.cognitiveservices.azure.com/',
      azureContentSafetyApiKey: 'test-key'
    }))
    clientFactory.mockReturnValue({ path: pathMock })
    pathMock.mockReturnValue({ post: postMock })
    isUnexpectedMock.mockReturnValue(false)
    postMock.mockResolvedValue({
      status: 200,
      body: {
        categoriesAnalysis: [
          { category: 'Hate', severity: 2 },
          { category: 'SelfHarm', severity: 4 },
          { category: 'Sexual', severity: 6 },
          { category: 'Violence', severity: 0 }
        ]
      }
    })
  })

  it('sends Base64 image content and preserves category severity', async () => {
    const result = await analyzeImageSafety(input)

    expect(credentialFactory).toHaveBeenCalledWith('test-key')
    expect(clientFactory).toHaveBeenCalledWith('https://example.cognitiveservices.azure.com/', {
      key: 'test-key'
    })
    expect(pathMock).toHaveBeenCalledWith('/image:analyze')
    expect(postMock).toHaveBeenCalledWith({
      body: {
        image: { content: Buffer.from(input.bytes).toString('base64') },
        categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
        outputType: 'FourSeverityLevels'
      }
    })
    expect(result).toEqual({
      provider: 'azure-content-safety',
      categories: {
        hate: 2,
        'self-harm': 4,
        sexual: 6,
        violence: 0
      }
    })
  })

  it('defaults missing categories to safe severity', async () => {
    postMock.mockResolvedValueOnce({
      status: 200,
      body: { categoriesAnalysis: [{ category: 'Hate', severity: 0 }] }
    })

    await expect(analyzeImageSafety(input)).resolves.toMatchObject({
      categories: {
        hate: 0,
        'self-harm': 0,
        sexual: 0,
        violence: 0
      }
    })
  })

  it('rejects unexpected SDK responses without exposing the provider payload', async () => {
    isUnexpectedMock.mockReturnValueOnce(true)
    postMock.mockResolvedValueOnce({
      status: 400,
      body: { error: { code: 'InvalidImage', message: 'provider secret' } }
    })

    await expect(analyzeImageSafety(input)).rejects.toMatchObject({
      name: 'AzureContentSafetyRequestError',
      provider: 'azure-content-safety',
      statusCode: 400,
      providerCode: 'InvalidImage'
    })
  })

  it('rejects malformed category severity values', async () => {
    postMock.mockResolvedValueOnce({
      status: 200,
      body: { categoriesAnalysis: [{ category: 'Hate', severity: 3 }] }
    })

    await expect(analyzeImageSafety(input)).rejects.toThrow(
      'Azure Content Safety returned an invalid response'
    )
  })

  it('rejects an empty category response instead of treating it as safe', async () => {
    postMock.mockResolvedValueOnce({ status: 200, body: { categoriesAnalysis: [] } })

    await expect(analyzeImageSafety(input)).rejects.toThrow(
      'Azure Content Safety returned an invalid response'
    )
  })
})
