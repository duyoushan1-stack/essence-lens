export interface ProviderImageInput {
  bytes: Uint8Array
  mimeType: string
  filename: string
}

export type AnalyzeSafety = (input: ProviderImageInput) => Promise<ContentSafetyAssessment>

export type AnalyzeSemantics = (input: ProviderImageInput) => Promise<ImageSemanticAnalysis>

export type GenerateProposal = (input: ProposalContext) => Promise<Proposal[]>

export interface ProposalProviderDependencies {
  analyzeSafety: AnalyzeSafety
  analyzeSemantics: AnalyzeSemantics
  generateProposal: GenerateProposal
}
