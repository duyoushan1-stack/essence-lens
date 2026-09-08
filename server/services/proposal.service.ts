import type { ProposalProviderDependencies, ProviderImageInput } from '../providers/provider.types'
import { evaluateImageFeasibilityForFile } from './image-feasibility.service'
import { createImageFingerprint } from '../utils/image-fingerprint'
import { normalizeProviderError } from '../utils/providers/error'
import { withRetry } from '../utils/retry-policy'
import type { ProposalDebugInfo } from '../../shared/types/proposal'

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

const mapProposalError = (): ProposalErrorCode => 'proposal-generation-failed'

interface CachedProposalResult {
  fingerprint: string
  outcome: ProposalPipelineResult
}

export const createProposalService = (
  dependencies: ProposalProviderDependencies
): ProposalService => {
  const executePipeline = async ({
    file
  }: ProposalPipelineInput, includeDebug: boolean): Promise<ProposalServiceOutcome> => {
    const feasibility = await evaluateImageFeasibilityForFile(file, dependencies, { includeDebug })

    if (feasibility.status === 'rejected' || feasibility.status === 'error') {
      return feasibility
    }

    try {
      const proposals = await withRetry(() => dependencies.generateProposal(feasibility.context))
      return {
        status: 'success',
        proposals,
        ...(includeDebug && feasibility.debug ? { debug: feasibility.debug } : {})
      }
    } catch (error: unknown) {
      const normalizedError = normalizeProviderError(error, 'gemini')

      return {
        status: 'error',
        code: mapProposalError(),
        ...(includeDebug
          ? {
              debug: {
                ...(feasibility.debug ?? {}),
                provider: {
                  provider: normalizedError.provider ?? 'gemini',
                  ...(normalizedError.statusCode !== undefined
                    ? { statusCode: normalizedError.statusCode }
                    : {}),
                  ...(normalizedError.providerCode !== undefined
                    ? { providerCode: normalizedError.providerCode }
                    : {})
                }
              }
            }
          : {})
      }
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
