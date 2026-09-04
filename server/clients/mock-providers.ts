import type { ProposalProviderDependencies } from './provider.types'

const MOCK_SAFETY: ContentSafetyAssessment = {
  provider: 'azure-content-safety',
  apiVersion: 'mock',
  categories: { hate: 0, 'self-harm': 0, sexual: 0, violence: 0 }
}

const MOCK_SEMANTICS: ImageSemanticAnalysis = {
  schemaVersion: 'image-semantic-analysis-v1',
  scene: { category: 'outdoor', recognizable: true },
  subjects: {
    peopleCount: 0,
    isSelfie: 'absent',
    hasProductFocus: 'absent',
    hasPetCloseup: 'absent',
    isMemeLike: 'absent'
  },
  quality: {
    blur: 'none',
    isSolidColor: 'absent',
    informationSufficient: true
  },
  safety: { nudity: 'absent', sexual: 'absent', violence: 'absent', gore: 'absent' },
  visualMood: ['calm', 'curious'],
  usefulObjects: ['street', 'light']
}

const MOCK_PROPOSALS: Proposal[] = [
  {
    title: '午後散步與咖啡',
    description: '到附近街區散步，再找一間安靜的咖啡店休息。'
  },
  {
    title: '沿街慢慢走',
    description: '沿著熟悉的街區走一小段，留意平常忽略的細節。'
  },
  {
    title: '黃昏取景',
    description: '在日落前找一個安靜的位置，替今天留下畫面。'
  }
]

export const createMockProposalProviders = (): ProposalProviderDependencies => ({
  analyzeSafety: async () => MOCK_SAFETY,
  analyzeSemantics: async () => MOCK_SEMANTICS,
  generateProposal: async () => MOCK_PROPOSALS
})
