import type {
  GroundedLocation,
  ProposalDraft,
  ProposalProviderDependencies
} from './provider.types'

const MOCK_SAFETY: ContentSafetyAssessment = {
  provider: 'azure-content-safety',
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

const MOCK_PROPOSAL_DRAFTS: ProposalDraft[] = [
  {
    locationCandidate: '大安森林公園',
    title: '午後散步與咖啡',
    summary: '到附近街區散步，再找一間安靜的咖啡店休息。',
    perspective: 'nature',
    itinerary: {
      morning: { title: '公園散步', description: '在樹影間放慢腳步。' },
      noon: { title: '街區午餐', description: '找一間在地小店用餐。' },
      afternoon: { title: '咖啡與閱讀', description: '選一個靠窗的位置休息。' }
    },
    cover: { imagePrompt: 'A calm tree-lined urban afternoon, editorial travel photography.' }
  },
  {
    title: '海風午後小旅行',
    locationCandidate: '淡水老街',
    summary: '沿著水岸吹風，把午後留給開闊的藍色風景與一頓慢午餐。',
    perspective: 'coast',
    itinerary: {
      morning: { title: '水岸看景', description: '找一段開闊的水岸迎接風。' },
      noon: { title: '海邊午餐', description: '選一間能看見風景的小店。' },
      afternoon: { title: '咖啡看潮', description: '用一杯咖啡替午後留白。' }
    },
    cover: {
      imagePrompt: 'A quiet seaside afternoon with a broad horizon, editorial travel photography.'
    }
  },
  {
    title: '老街微光散策',
    locationCandidate: '迪化街',
    summary: '穿過有故事的街區，從在地味道與老屋細節認識一座城市。',
    perspective: 'culture',
    itinerary: {
      morning: { title: '老街尋光', description: '沿著老屋與街角慢慢逛。' },
      noon: { title: '在地小吃', description: '挑一間有地方味道的小店。' },
      afternoon: { title: '選物慢看', description: '把時間留給一間有趣的小店。' }
    },
    cover: {
      imagePrompt:
        'A warm heritage street at golden hour with small local shops, editorial travel photography.'
    }
  }
]

/** 僅供 development mock 展示，不代表本次 request 執行過 Maps 查證。 */
const MOCK_LOCATIONS: GroundedLocation[] = [
  {
    name: '大安森林公園',
    displayName: '大安森林公園',
    address: '臺北市大安區新生南路二段',
    sourceUrl: 'https://www.google.com/maps/search/?api=1&query=大安森林公園',
    reason: '開發測試資料',
    suggestedActivities: ['沿著公園步道散步']
  },
  {
    name: '淡水老街',
    displayName: '淡水老街',
    address: '新北市淡水區中正路',
    sourceUrl: 'https://www.google.com/maps/search/?api=1&query=淡水老街',
    reason: '開發測試資料',
    suggestedActivities: ['沿著老街步行']
  },
  {
    name: '迪化街',
    displayName: '迪化街',
    address: '臺北市大同區迪化街一段',
    sourceUrl: 'https://www.google.com/maps/search/?api=1&query=迪化街',
    reason: '開發測試資料',
    suggestedActivities: ['觀察歷史街屋立面']
  }
]

export const createMockProposalProviders = (): ProposalProviderDependencies => ({
  analyzeSafety: async () => MOCK_SAFETY,
  analyzeSemantics: async () => MOCK_SEMANTICS,
  groundLocations: async () => MOCK_LOCATIONS,
  generateProposal: async () => MOCK_PROPOSAL_DRAFTS,
  generateProposalImage: async () => null
})
