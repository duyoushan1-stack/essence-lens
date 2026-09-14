import { randomUUID } from 'node:crypto'
import { proposalSchema } from '../../shared/schemas/proposal'
import type { Proposal, ProposalDebugInfo } from '../../shared/types/proposal'
import type {
  GroundedLocation,
  ProposalDraft,
  ProposalProviderDependencies,
  ProviderImageInput
} from '../providers/provider.types'
import { evaluateImageFeasibilityForFile } from './image-feasibility.service'
import { createImageFingerprint } from '../utils/image-fingerprint'
import { normalizeProviderError, toProviderValidationIssues } from '../utils/providers/error'
import { withRetry } from '../utils/retry-policy'
import { proposalDraftListSchema } from '../providers/gemini/schemas/proposal-draft.schema'

const DEFAULT_LOCALE = 'zh-TW'

export interface ProposalPipelineInput {
  file: ProviderImageInput
  idempotencyKey: string
  debug?: boolean
}

export type ProposalPipelineResult = ProposalOutcome

export type ProposalServiceOutcome = ProposalPipelineResult & { debug?: ProposalDebugInfo }

export type ProposalServiceResult = ProposalServiceOutcome | { status: 'conflict' }

export interface ProposalService {
  generate(input: ProposalPipelineInput): Promise<ProposalServiceResult>
}

interface CachedProposalResult {
  fingerprint: string
  outcome: ProposalPipelineResult
}

const getProviderErrorCode = (error: unknown): ProposalErrorCode => {
  const normalizedError = normalizeProviderError(error, 'gemini')

  const codeByKind: Record<ReturnType<typeof normalizeProviderError>['kind'], ProposalErrorCode> = {
    configuration: 'provider-config-invalid',
    authentication: 'provider-authentication-failed',
    'invalid-request': 'provider-invalid-request',
    transient: 'provider-unavailable',
    'invalid-response': 'malformed-provider-response',
    unknown: 'proposal-generation-failed'
  }

  return codeByKind[normalizedError.kind]
}

const getProviderDebug = (error: unknown): NonNullable<ProposalDebugInfo['provider']> => {
  const normalizedError = normalizeProviderError(error, 'gemini')

  return {
    provider: normalizedError.provider ?? 'gemini',
    ...(normalizedError.statusCode !== undefined ? { statusCode: normalizedError.statusCode } : {}),
    ...(normalizedError.providerCode !== undefined
      ? { providerCode: normalizedError.providerCode }
      : {}),
    ...(normalizedError.stage !== undefined ? { stage: normalizedError.stage } : {}),
    ...(normalizedError.validationIssues !== undefined
      ? { validationIssues: normalizedError.validationIssues }
      : {})
  }
}

const getLocationMatch = (candidate: string, locations: ReadonlyArray<GroundedLocation>) => {
  const normalizedCandidate = candidate.trim().toLocaleLowerCase()

  return locations.find(
    (location) => location.name.trim().toLocaleLowerCase() === normalizedCandidate
  )
}

const createLocationUrl = (location: GroundedLocation) => {
  if (
    location.sourceUrl.startsWith('https://www.google.com/maps/') ||
    location.sourceUrl.startsWith('https://maps.google.com/')
  ) {
    return location.sourceUrl
  }

  const query = [location.name, location.address].filter(Boolean).join(', ')

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

const toCover = (
  draft: ProposalDraft,
  result: PromiseSettledResult<{ imageUrl?: string } | null>
) => {
  if (result.status === 'rejected') {
    return {
      imagePrompt: draft.cover.imagePrompt,
      status: 'failed' as const
    }
  }

  if (result.value?.imageUrl) {
    return {
      imagePrompt: draft.cover.imagePrompt,
      imageUrl: result.value.imageUrl,
      status: 'ready' as const
    }
  }

  return {
    imagePrompt: draft.cover.imagePrompt,
    status: 'unavailable' as const
  }
}

const toProposal = (
  draft: ProposalDraft,
  location: GroundedLocation | undefined,
  coverResult: PromiseSettledResult<{ imageUrl?: string } | null>
): Proposal => {
  const proposal = {
    id: randomUUID(),
    title: draft.title,
    summary: draft.summary,
    ...(draft.perspective ? { perspective: draft.perspective } : {}),
    itinerary: draft.itinerary,
    ...(location
      ? {
          location: {
            name: location.displayName,
            ...(location.address ? { address: location.address } : {}),
            externalUrl: createLocationUrl(location)
          }
        }
      : {}),
    cover: toCover(draft, coverResult)
  }

  return proposalSchema.parse(proposal)
}

const validateDrafts = (drafts: ProposalDraft[], locations: ReadonlyArray<GroundedLocation>) => {
  const result = proposalDraftListSchema.safeParse(drafts)

  if (!result.success) {
    throw {
      provider: 'gemini',
      code: 'schema-validation-failed',
      stage: 'proposal-generation',
      validationIssues: toProviderValidationIssues(result.error.issues)
    }
  }

  for (const [index, draft] of result.data.entries()) {
    if (!getLocationMatch(draft.locationCandidate, locations)) {
      throw {
        provider: 'gemini',
        code: 'schema-validation-failed',
        stage: 'proposal-generation',
        validationIssues: [{ path: `[${index}].locationCandidate`, code: 'unmatched-location' }]
      }
    }
  }

  return result.data
}

export const createProposalService = (
  dependencies: ProposalProviderDependencies
): ProposalService => {
  const executePipeline = async (
    { file }: ProposalPipelineInput,
    includeDebug: boolean
  ): Promise<ProposalServiceOutcome> => {
    const feasibility = await evaluateImageFeasibilityForFile(file, dependencies, { includeDebug })

    if (feasibility.status === 'rejected' || feasibility.status === 'error') {
      return feasibility
    }

    let locations: GroundedLocation[] = []

    try {
      locations = await withRetry(() =>
        dependencies.groundLocations({
          analysis: feasibility.context,
          locale: DEFAULT_LOCALE
        })
      )
      if (locations.length === 0) {
        throw { provider: 'gemini', code: 'schema-validation-failed', stage: 'grounding' }
      }
    } catch (error: unknown) {
      return {
        status: 'error',
        code: getProviderErrorCode(error),
        ...(includeDebug
          ? {
              debug: {
                ...feasibility.debug,
                provider: { ...getProviderDebug(error), stage: 'grounding' }
              }
            }
          : {})
      }
    }

    const debug = includeDebug ? feasibility.debug : undefined

    let drafts: ProposalDraft[]

    try {
      drafts = validateDrafts(
        await withRetry(() =>
          dependencies.generateProposal({
            analysis: feasibility.context,
            locations,
            locale: DEFAULT_LOCALE
          })
        ),
        locations
      )
    } catch (error: unknown) {
      return {
        status: 'error',
        code: getProviderErrorCode(error),
        ...(debug ? { debug: { ...debug, provider: getProviderDebug(error) } } : {})
      }
    }

    const coverResults = await Promise.allSettled(
      drafts.map((draft) =>
        withRetry(() =>
          dependencies.generateProposalImage({
            imagePrompt: draft.cover.imagePrompt
          })
        )
      )
    )

    const proposals = drafts.map((draft, index) =>
      toProposal(draft, getLocationMatch(draft.locationCandidate, locations), coverResults[index]!)
    )

    return {
      status: 'success',
      proposals,
      ...(debug ? { debug } : {})
    }
  }

  /**
   * 以 Client 提供的 idempotency key 作為單次操作的 cache key。
   *
   * 目前的邏輯 key 可表示為：
   * `proposal-pipeline-idempotency-{idempotencyKey}`。
   * 未來若有登入 user identity 與明確時間窗口，才可評估改成：
   * `proposal-{userId}-{fingerprint}-{timeWindow}`。
   * fingerprint 仍會保留在 cached value 內，負責偵測同 key 的 payload conflict。
   */
  const cachedPipeline = defineCachedFunction(
    async (
      input: ProposalPipelineInput & { fingerprint: string }
    ): Promise<CachedProposalResult> => ({
      fingerprint: input.fingerprint,
      outcome: await executePipeline(input, false)
    }),
    {
      name: 'proposal-pipeline-idempotency',
      maxAge: 600,
      swr: false,
      getKey: ({ idempotencyKey }: ProposalPipelineInput) => idempotencyKey
    }
  )

  return {
    async generate(input) {
      if (input.debug) {
        return executePipeline(input, true)
      }

      const fingerprint = createImageFingerprint(input.file)
      const cachedResult = await cachedPipeline({
        file: input.file,
        idempotencyKey: input.idempotencyKey,
        fingerprint
      })

      if (cachedResult.fingerprint !== fingerprint) {
        return { status: 'conflict' }
      }

      return cachedResult.outcome
    }
  }
}
