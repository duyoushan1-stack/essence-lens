import {
  createAzureContentSafetyProvider,
  type AzureContentSafetyConfig
} from '../../providers/azure-content-safety'
import {
  createGeminiAnalysisProvider,
  createGeminiClient,
  createGeminiGroundingProvider,
  createGeminiProposalProvider
} from '../../providers/gemini/index'
import { createAgnesImageProvider } from '../../providers/agnes'
import { createMockProposalProviders } from '../../providers/mock-providers'
import type { ProposalProviderDependencies } from '../../providers/provider.types'
import { createProposalService, type ProposalService } from '../../services/proposal.service'

let defaultProposalService: ProposalService | null = null

interface RealProposalProviderConfig {
  azureContentSafety: AzureContentSafetyConfig
  geminiApiKey: string
  geminiSemanticModel: string
  geminiGroundingModel: string
  geminiProposalModel: string
  agnesApiKey: string
  agnesImageModel: string
  agnesApiBaseUrl: string
}

const createRealProposalProviders = (
  config: RealProposalProviderConfig
): ProposalProviderDependencies => {
  const geminiClient = createGeminiClient(config.geminiApiKey)

  return {
    analyzeSafety: createAzureContentSafetyProvider(config.azureContentSafety),
    analyzeSemantics: createGeminiAnalysisProvider({
      client: geminiClient,
      model: config.geminiSemanticModel
    }),
    groundLocations: createGeminiGroundingProvider({
      client: geminiClient,
      model: config.geminiGroundingModel
    }),
    generateProposal: createGeminiProposalProvider({
      client: geminiClient,
      model: config.geminiProposalModel
    }),
    generateProposalImage: createAgnesImageProvider({
      apiKey: config.agnesApiKey,
      model: config.agnesImageModel,
      baseUrl: config.agnesApiBaseUrl
    })
  }
}

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
          geminiApiKey: config.geminiApiKey,
          geminiSemanticModel: config.geminiSemanticModel,
          geminiGroundingModel: config.geminiGroundingModel || config.geminiProposalModel || config.geminiSemanticModel,
          geminiProposalModel: config.geminiProposalModel || config.geminiSemanticModel,
          agnesApiKey: config.agnesApiKey,
          agnesImageModel: config.agnesImageModel || 'agnes-image-2.5-flash',
          agnesApiBaseUrl: config.agnesApiBaseUrl || 'https://apihub.agnes-ai.com'
        })
  )

  return defaultProposalService
}
