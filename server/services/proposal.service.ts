import { createHash } from 'node:crypto'
import type { ProposalProviderDependencies, ProviderImageInput } from '../providers/provider.types'
import { evaluateImageFeasibilityForFile } from './image-feasibility.service'

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

const createPayloadFingerprint = ({ bytes, mimeType, filename }: ProviderImageInput): string =>
  createHash('sha256')
    .update(bytes)
    .update('\0')
    .update(mimeType)
    .update('\0')
    .update(filename)
    .digest('hex')

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
      const proposals = await dependencies.generateProposal(feasibility.context)
      return { status: 'success', proposals }
    } catch {
      return { status: 'error', code: mapProposalError() }
    }
  }

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
      const fingerprint = createPayloadFingerprint(input.file)
      const cachedResult = await cachedPipeline({ ...input, fingerprint })

      if (cachedResult.fingerprint !== fingerprint) {
        return { status: 'conflict' }
      }

      return cachedResult.outcome
    }
  }
}
