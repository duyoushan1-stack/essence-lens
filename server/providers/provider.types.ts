import type {
  ImageSemanticAnalysis,
  ContentSafetyAssessment
} from '../../shared/types/image-feasibility'
import type {
  Proposal,
  ProposalContext,
  ProposalItinerary,
  ProposalPerspective
} from '../../shared/types/proposal'

export interface ProviderImageInput {
  bytes: Uint8Array
  mimeType: string
  filename: string
}

export type AnalyzeSafety = (input: ProviderImageInput) => Promise<ContentSafetyAssessment>

export type AnalyzeSemantics = (input: ProviderImageInput) => Promise<ImageSemanticAnalysis>

export interface ProposalLocationHint {
  city?: string
  region?: string
  countryCode?: string
}

export interface GroundLocationsInput {
  analysis: ProposalContext
  locale: string
  locationHint?: ProposalLocationHint
}

export interface GroundedLocation {
  name: string
  displayName: string
  address?: string
  sourceUrl: string
  reason: string
  suggestedActivities: string[]
}

export interface ProposalGenerationContext {
  analysis: ProposalContext
  locations: ReadonlyArray<GroundedLocation>
  locale: string
}

export interface ProposalDraft {
  title: string
  summary: string
  perspective: ProposalPerspective
  itinerary: ProposalItinerary
  locationCandidate: string
  cover: {
    imagePrompt: string
  }
}

export interface GenerateProposalImageInput {
  imagePrompt: string
}

export interface GeneratedProposalImage {
  imageUrl?: string
}

export type GroundLocations = (input: GroundLocationsInput) => Promise<GroundedLocation[]>

export type GenerateProposal = (input: ProposalGenerationContext) => Promise<ProposalDraft[]>

export type GenerateProposalImage = (
  input: GenerateProposalImageInput
) => Promise<GeneratedProposalImage | null>

export interface ProposalProviderDependencies {
  analyzeSafety: AnalyzeSafety
  analyzeSemantics: AnalyzeSemantics
  groundLocations: GroundLocations
  generateProposal: GenerateProposal
  generateProposalImage: GenerateProposalImage
}

export type { Proposal }
