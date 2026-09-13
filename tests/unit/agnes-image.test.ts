import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAgnesImageProvider } from '../../server/providers/agnes/image'

const imageInput = { imagePrompt: 'An editorial coastal trail at golden hour.' }

describe('createAgnesImageProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests a 1K 3:2 image and returns the provider URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ url: 'https://cdn.example.com/generated-cover.png' }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const generateImage = createAgnesImageProvider({
      apiKey: 'test-agnes-key',
      model: 'agnes-image-2.5-flash'
    })

    await expect(generateImage(imageInput)).resolves.toEqual({
      imageUrl: 'https://cdn.example.com/generated-cover.png'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://apihub.agnes-ai.com/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-agnes-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'agnes-image-2.5-flash',
          prompt: imageInput.imagePrompt,
          size: '1K',
          ratio: '3:2',
          extra_body: { response_format: 'url' }
        })
      })
    )
  })

  it('returns null when Agnes is not configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const generateImage = createAgnesImageProvider({ apiKey: '', model: '' })

    await expect(generateImage(imageInput)).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an HTTP failure without exposing the response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('private provider error', { status: 502, statusText: 'Bad Gateway' })
    )
    vi.stubGlobal('fetch', fetchMock)

    const generateImage = createAgnesImageProvider({
      apiKey: 'test-agnes-key',
      model: 'agnes-image-2.5-flash'
    })

    const request = generateImage(imageInput)

    await expect(request).rejects.toMatchObject({
      provider: 'agnes-ai',
      statusCode: 502,
      providerCode: 'http-502'
    })
    await expect(request).rejects.not.toThrow('private provider error')
  })

  it('rejects a response without a public image URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: 'raw-image-data' }] }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const generateImage = createAgnesImageProvider({
      apiKey: 'test-agnes-key',
      model: 'agnes-image-2.5-flash'
    })

    await expect(generateImage(imageInput)).rejects.toMatchObject({
      provider: 'agnes-ai',
      providerCode: 'malformed-response'
    })
  })
})
