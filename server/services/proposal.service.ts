import type { ProposalProviderDependencies, ProviderImageInput } from '../providers/provider.types'
import { evaluateImageFeasibilityForFile } from './image-feasibility.service'
import { createImageFingerprint } from '../utils/image-fingerprint'
import { withRetry } from '../utils/retry-policy'

export interface ProposalPipelineInput {
  file: ProviderImageInput
  idempotencyKey: string
}

export type ProposalPipelineResult = ProposalOutcome

export type ProposalServiceResult = ProposalPipelineResult | { status: 'conflict' }

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
  }: ProposalPipelineInput): Promise<ProposalPipelineResult> => {
    const feasibility = await evaluateImageFeasibilityForFile(file, dependencies)

    if (feasibility.status === 'rejected' || feasibility.status === 'error') {
      return feasibility
    }

    try {
      const proposals = await withRetry(() => dependencies.generateProposal(feasibility.context))
      return { status: 'success', proposals }
    } catch {
      return { status: 'error', code: mapProposalError() }
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
      outcome: await executePipeline(input)
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
      const fingerprint = createImageFingerprint(input.file)
      const cachedResult = await cachedPipeline({ ...input, fingerprint })

      if (cachedResult.fingerprint !== fingerprint) {
        return { status: 'conflict' }
      }

      return cachedResult.outcome
    }
  }
}
