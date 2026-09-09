import ContentSafetyClient, { isUnexpected } from '@azure-rest/ai-content-safety'
import { AzureKeyCredential } from '@azure/core-auth'
import type {
  ContentSafetyAssessment,
  ContentSafetyCategory,
  ContentSafetySeverity
} from '../../shared/types/image-feasibility'
import type { AnalyzeSafety, ProviderImageInput } from './provider.types'

export interface AzureContentSafetyConfig {
  endpoint: string
  apiKey: string
}

const CATEGORY_MAP = {
  Hate: 'hate',
  SelfHarm: 'self-harm',
  Sexual: 'sexual',
  Violence: 'violence'
} as const satisfies Record<string, ContentSafetyCategory>

const isContentSafetySeverity = (value: unknown): value is ContentSafetySeverity =>
  value === 0 || value === 2 || value === 4 || value === 6

const getStatusCode = (value: unknown): number | undefined => {
  if (typeof value !== 'object' || value === null || !('status' in value)) {
    return undefined
  }

  const status = value.status
  const statusCode = typeof status === 'string' || typeof status === 'number' ? Number(status) : NaN

  return Number.isInteger(statusCode) ? statusCode : undefined
}

const getProviderCode = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null || !('body' in value)) {
    return undefined
  }

  const body = value.body

  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined
  }

  const error = body.error

  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined
  }

  return typeof error.code === 'string' ? error.code : undefined
}

const createEmptyCategories = (): Record<ContentSafetyCategory, ContentSafetySeverity> => ({
  hate: 0,
  'self-harm': 0,
  sexual: 0,
  violence: 0
})

class AzureContentSafetyRequestError extends Error {
  readonly provider = 'azure-content-safety'

  constructor(
    readonly statusCode?: number,
    readonly providerCode: string = 'request-failed'
  ) {
    super('Azure Content Safety request failed')
    this.name = 'AzureContentSafetyRequestError'
  }
}

class AzureContentSafetyResponseError extends Error {
  readonly code = 'malformed-response'

  constructor() {
    super('Azure Content Safety returned an invalid response')
    this.name = 'AzureContentSafetyResponseError'
  }
}

const toContentSafetyAssessment = (value: unknown): ContentSafetyAssessment => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AzureContentSafetyResponseError()
  }

  const categories = createEmptyCategories()

  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      throw new AzureContentSafetyResponseError()
    }

    const category = 'category' in item ? item.category : null
    const severity = 'severity' in item ? item.severity : null

    if (
      typeof category !== 'string' ||
      !(category in CATEGORY_MAP) ||
      !isContentSafetySeverity(severity)
    ) {
      throw new AzureContentSafetyResponseError()
    }

    const internalCategory = CATEGORY_MAP[category as keyof typeof CATEGORY_MAP]
    categories[internalCategory] = severity
  }

  return {
    provider: 'azure-content-safety',
    categories
  }
}

export const createAzureContentSafetyProvider = (
  config: AzureContentSafetyConfig
): AnalyzeSafety => {
  return async (input: ProviderImageInput): Promise<ContentSafetyAssessment> => {
    if (!config.endpoint || !config.apiKey) {
      throw new AzureContentSafetyRequestError(undefined, 'missing-configuration')
    }

    const client = ContentSafetyClient(
      config.endpoint,
      new AzureKeyCredential(config.apiKey)
    )

    const result = await client.path('/image:analyze').post({
      body: {
        image: { content: Buffer.from(input.bytes).toString('base64') },
        categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
        outputType: 'FourSeverityLevels'
      }
    })

    if (isUnexpected(result)) {
      throw new AzureContentSafetyRequestError(getStatusCode(result), getProviderCode(result))
    }

    return toContentSafetyAssessment(result.body.categoriesAnalysis)
  }
}
