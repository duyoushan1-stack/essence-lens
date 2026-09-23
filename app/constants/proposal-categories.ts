import type { ProposalPerspective } from '../../shared/types/proposal'

export const ALL_PROPOSALS_CATEGORY_ID = 'all' as const
export const UNCATEGORIZED_PROPOSALS_CATEGORY_ID = 'uncategorized' as const

export const PROPOSAL_CATEGORIES = [
  { id: 'nature', label: '自然', perspective: 'nature' },
  { id: 'coast', label: '海岸', perspective: 'coast' },
  { id: 'culture', label: '文化', perspective: 'culture' },
  { id: 'food', label: '食物', perspective: 'food' },
  { id: 'active', label: '動態', perspective: 'active' },
  { id: 'rest', label: '休息', perspective: 'rest' }
] as const satisfies ReadonlyArray<{
  id: ProposalPerspective
  label: string
  perspective: ProposalPerspective
}>

export const getProposalCategoryLabel = (perspective?: ProposalPerspective) =>
  PROPOSAL_CATEGORIES.find((category) => category.perspective === perspective)?.label ?? '未分類'
