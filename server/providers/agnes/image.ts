import type {
  GenerateProposalImage,
  GeneratedProposalImage
} from '../provider.types'

const DEFAULT_BASE_URL = 'https://apihub.agnes-ai.com'
const IMAGE_GENERATION_PATH = '/v1/images/generations'

export interface AgnesImageProviderConfig {
  apiKey: string
  model: string
  baseUrl?: string
}

interface UnknownRecord {
  [key: string]: unknown
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const isPublicImageUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) {
    return false
  }

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export class AgnesImageRequestError extends Error {
  readonly provider = 'agnes-ai'

  constructor(
    readonly statusCode: number | undefined,
    readonly providerCode: string
  ) {
    super('Agnes image request failed')
    this.name = 'AgnesImageRequestError'
  }
}

const parseImageResponse = (payload: unknown): GeneratedProposalImage => {
  const data = isRecord(payload) && Array.isArray(payload.data) ? payload.data : []
  const firstResult = data[0]

  if (!isRecord(firstResult) || !isPublicImageUrl(firstResult.url)) {
    throw new AgnesImageRequestError(undefined, 'malformed-response')
  }

  return { imageUrl: firstResult.url }
}

const createImageEndpoint = (baseUrl: string) =>
  `${baseUrl.replace(/\/+$/, '')}${IMAGE_GENERATION_PATH}`

export const createAgnesImageProvider = (
  config: AgnesImageProviderConfig
): GenerateProposalImage => {
  return async ({ imagePrompt }) => {
    if (!config.apiKey || !config.model) {
      return null
    }

    let response: Response

    try {
      response = await fetch(createImageEndpoint(config.baseUrl ?? DEFAULT_BASE_URL), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          prompt: imagePrompt,
          size: '1K',
          ratio: '3:2',
          extra_body: { response_format: 'url' }
        })
      })
    } catch {
      throw new AgnesImageRequestError(undefined, 'request-failed')
    }

    if (!response.ok) {
      throw new AgnesImageRequestError(response.status, `http-${response.status}`)
    }

    let payload: unknown

    try {
      payload = await response.json()
    } catch {
      throw new AgnesImageRequestError(undefined, 'malformed-response')
    }

    return parseImageResponse(payload)
  }
}
