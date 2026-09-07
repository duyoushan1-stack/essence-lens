import { analyzeImageSafety } from '../../providers/azure-content-safety'
import { analyzeImageSemantics, generateProposal } from '../../providers/gemini'
import { createMockProposalProviders } from '../../providers/mock-providers'
import { createProposalService, type ProposalService } from '../../services/proposal.service'

let defaultProposalService: ProposalService | null = null

/** 建立目前 runtime mode 對應的 ProposalService，並在 process 內重用同一個 instance。 */
export const getProposalService = (): ProposalService => {
  if (defaultProposalService) {
    return defaultProposalService
  }

  const config = useRuntimeConfig()
  const useMockProviders = import.meta.dev && config.proposalProviderMode !== 'azure'

  defaultProposalService = createProposalService(
    useMockProviders
      ? createMockProposalProviders()
      : {
          analyzeSafety: analyzeImageSafety,
          analyzeSemantics: analyzeImageSemantics,
          generateProposal
        }
  )

  return defaultProposalService
}
