import * as z from 'zod'
import type { GroundedLocation, GroundLocations } from '../provider.types'
import { createGeminiProviderError, toGeminiRequestError } from './error'
import type { GeminiClient } from './client'
import { toProviderValidationIssues } from '../../utils/providers/error'

export interface GeminiGroundingProviderConfig {
  client: GeminiClient | null
  model: string
}

const groundedLocationDraftSchema = z
  .array(
    z.strictObject({
      name: z.string().trim().min(1),
      displayName: z.string().trim().min(1),
      address: z.string().trim().min(1).optional(),
      reason: z.string().trim().min(1),
      suggestedActivities: z.array(z.string().trim().min(1)).min(1).max(3)
    })
  )
  .min(1)
  .max(3)

const groundedLocationDraftJsonSchema = z.toJSONSchema(groundedLocationDraftSchema)
delete groundedLocationDraftJsonSchema.$schema

const GROUNDING_PROMPT = `Find up to three real places that could anchor a gentle weekend proposal.

Return only JSON matching the response schema.
- Use the canonical Google Maps place name and address for name and address.
- Return displayName as a concise Traditional Chinese (zh-TW) name for user-facing UI. Keep name unchanged for exact matching.
- Use Google Maps grounding to verify that each place exists and is currently searchable.
- Do not claim that the uploaded image reveals an exact location. Use the visual analysis only to choose an appropriate kind of destination.
- Match distinctive visible settings, architecture and objects first; mood alone is insufficient. Visual similarity takes priority over diversity.
- Vary experiences within that theme. Historic streetscapes support architecture walks or street photography, not unrelated mountain hikes or open waterfronts merely for variety.
- Return fewer places when necessary; do not fill category quotas.
- Explain which supplied visual features each destination matches using grounded place information.
- Provide one to three suggestedActivities in Traditional Chinese (zh-TW) per destination: concrete actions supported by grounded information or a direct reasonable use of the verified place itself.
- Write reason in Traditional Chinese (zh-TW), explaining which supplied visual features the destination matches.
- Do not invent shops, dishes, exhibitions, events, opening hours or facilities. Avoid vague actions such as relax or enjoy the atmosphere.
- Copy each name from a Maps tool place or place citation, excluding the trailing " - Google Maps" source label. Include the verified address when available; omit unverified addresses.
- These are recommended destinations, not photo capture locations. Locale is a language preference, not evidence of the user's location.
- Do not invent names, addresses, or coordinates.
- Return only places supported by a Google Maps tool place source or place citation.`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isTextContent = (value: unknown): value is { type: 'text'; annotations?: unknown[] } =>
  isRecord(value) && value.type === 'text'

const normalizePlaceName = (name: string) =>
  name
    .replace(/\s+- Google Maps$/i, '')
    .trim()
    .normalize('NFKC')
    .toLowerCase()

const toPlaceSource = (value: unknown): { name: string; url: string } | undefined => {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.url !== 'string')
    return undefined
  const url = URL.parse(value.url)
  if (
    !url ||
    url.protocol !== 'https:' ||
    url.pathname.startsWith('/maps/reviews') ||
    /^Review of /i.test(value.name)
  )
    return undefined
  return { name: value.name.trim(), url: value.url }
}

const getPlaceCitations = (interaction: unknown) => {
  if (!isRecord(interaction) || !Array.isArray(interaction.steps)) {
    return []
  }

  const citations: Array<{ name: string; url: string }> = []

  for (const step of interaction.steps) {
    // Structured output can omit text annotations while the Maps tool still returns verified places.
    if (isRecord(step) && step.type === 'google_maps_result' && Array.isArray(step.result)) {
      for (const result of step.result) {
        if (!isRecord(result) || !Array.isArray(result.places)) continue
        for (const place of result.places) {
          const source = toPlaceSource(place)
          if (source) citations.push(source)
        }
      }
    }
    if (!isRecord(step) || step.type !== 'model_output' || !Array.isArray(step.content)) {
      continue
    }

    for (const content of step.content) {
      if (!isTextContent(content) || !Array.isArray(content.annotations)) {
        continue
      }

      for (const annotation of content.annotations) {
        if (!isRecord(annotation) || annotation.type !== 'place_citation') {
          continue
        }

        const source = toPlaceSource(annotation)
        if (source) citations.push(source)
      }
    }
  }

  return citations
}

const parseGroundedLocationDrafts = (text: string | undefined) => {
  if (!text) {
    return createGeminiProviderError('schema-validation-failed', { stage: 'grounding' })
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return createGeminiProviderError('schema-validation-failed', { stage: 'grounding' })
  }

  const result = groundedLocationDraftSchema.safeParse(parsed)

  if (!result.success) {
    return createGeminiProviderError('schema-validation-failed', {
      stage: 'grounding',
      validationIssues: toProviderValidationIssues(result.error.issues)
    })
  }

  return result.data
}

type GroundedLocationDraft = z.infer<typeof groundedLocationDraftSchema>[number]

const getCitationUrl = (name: string, citations: ReadonlyArray<{ name: string; url: string }>) => {
  const normalizedName = normalizePlaceName(name)
  const matches = citations.filter(
    (citation) => normalizePlaceName(citation.name) === normalizedName
  )

  const urls = new Set(matches.map((citation) => citation.url))
  return urls.size === 1 ? matches[0]?.url : undefined
}

const toGroundedLocations = (
  drafts: GroundedLocationDraft[],
  citations: ReadonlyArray<{ name: string; url: string }>
): GroundedLocation[] =>
  drafts.map((draft) => ({
    name: draft.name,
    displayName: draft.displayName,
    ...(draft.address ? { address: draft.address } : {}),
    sourceUrl: getCitationUrl(draft.name, citations) ?? '',
    reason: draft.reason,
    suggestedActivities: draft.suggestedActivities
  }))

export const createGeminiGroundingProvider = (
  config: GeminiGroundingProviderConfig
): GroundLocations => {
  return async ({ analysis, locale, locationHint }) => {
    if (!config.client || !config.model) {
      return createGeminiProviderError('missing-configuration')
    }

    const prompt = `${GROUNDING_PROMPT}

Downstream proposal locale: ${locale}
Respect this destination search area when supplied: ${JSON.stringify(locationHint ?? null)}
Visual analysis:
${JSON.stringify(analysis)}`

    try {
      const interaction = await config.client.interactions.create({
        model: config.model,
        input: [{ type: 'text', text: prompt }],
        tools: [{ type: 'google_maps' }],
        generation_config: {
          max_output_tokens: 2048
        },
        response_format: [
          {
            type: 'text',
            mime_type: 'application/json',
            schema: groundedLocationDraftJsonSchema
          }
        ]
      })

      const drafts = parseGroundedLocationDrafts(interaction.output_text)
      const locations = toGroundedLocations(drafts, getPlaceCitations(interaction))

      return locations.filter((location) => location.sourceUrl.length > 0)
    } catch (error: unknown) {
      if (isGeminiProviderError(error)) {
        throw error
      }

      throw toGeminiRequestError(error)
    }
  }
}

const isGeminiProviderError = (error: unknown): error is { provider: 'gemini'; code: string } =>
  typeof error === 'object' &&
  error !== null &&
  'provider' in error &&
  error.provider === 'gemini' &&
  'code' in error &&
  typeof error.code === 'string'
