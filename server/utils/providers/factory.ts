import {
  createAzureContentSafetyProvider,
  type AzureContentSafetyConfig
} from '../../providers/azure-content-safety'
import {
  createGeminiSemanticProvider,
  type GeminiSemanticConfig,
  generateProposal
} from '../../providers/gemini'
import { createMockProposalProviders } from '../../providers/mock-providers'
import type { ProposalProviderDependencies } from '../../providers/provider.types'
import { createProposalService, type ProposalService } from '../../services/proposal.service'

let defaultProposalService: ProposalService | null = null

interface RealProposalProviderConfig {
  azureContentSafety: AzureContentSafetyConfig
  gemini: GeminiSemanticConfig
}

const createRealProposalProviders = (
  config: RealProposalProviderConfig
): ProposalProviderDependencies => ({
  analyzeSafety: createAzureContentSafetyProvider(config.azureContentSafety),
  analyzeSemantics: createGeminiSemanticProvider(config.gemini),
  generateProposal
})

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
      : createRealProposalProviders({
          azureContentSafety: {
            endpoint: config.azureContentSafetyEndpoint,
            apiKey: config.azureContentSafetyApiKey
          },
          gemini: {
            apiKey: config.geminiApiKey,
            model: config.geminiSemanticModel
          }
        })
  )

  return defaultProposalService
}
