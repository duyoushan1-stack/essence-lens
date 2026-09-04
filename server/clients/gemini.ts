import type { AnalyzeSemantics, GenerateProposal, ProviderImageInput } from './provider.types'

export const analyzeImageSemantics: AnalyzeSemantics = async (
  _input: ProviderImageInput
): Promise<ImageSemanticAnalysis> => {
  throw new Error('Gemini provider is not connected')
}

export const generateProposal: GenerateProposal = async (
  _input: ProposalContext
): Promise<Proposal[]> => {
  throw new Error('Gemini provider is not connected')
}
