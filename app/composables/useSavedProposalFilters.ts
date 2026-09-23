import type { ProposalPerspective } from '../../shared/types/proposal'
import {
  ALL_PROPOSALS_CATEGORY_ID,
  PROPOSAL_CATEGORIES,
  UNCATEGORIZED_PROPOSALS_CATEGORY_ID,
  getProposalCategoryLabel
} from '../constants/proposal-categories'

type ProposalCategoryFilter =
  | ProposalPerspective
  | typeof ALL_PROPOSALS_CATEGORY_ID
  | typeof UNCATEGORIZED_PROPOSALS_CATEGORY_ID

const VALID_CATEGORY_FILTERS: ReadonlyArray<ProposalCategoryFilter> = [
  ALL_PROPOSALS_CATEGORY_ID,
  UNCATEGORIZED_PROPOSALS_CATEGORY_ID,
  ...PROPOSAL_CATEGORIES.map((category) => category.id)
]

const isProposalCategoryFilter = (value: string): value is ProposalCategoryFilter =>
  VALID_CATEGORY_FILTERS.some((category) => category === value)

export function useSavedProposalFilters() {
  const route = useRoute()
  const router = useRouter()
  const savedProposals = useSavedProposalsStore()
  const searchInput = ref(typeof route.query.q === 'string' ? route.query.q : '')
  const queryTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  const selectedCategory = computed<ProposalCategoryFilter>(() => {
    const category =
      typeof route.query.category === 'string' ? route.query.category : ALL_PROPOSALS_CATEGORY_ID
    return isProposalCategoryFilter(category) ? category : ALL_PROPOSALS_CATEGORY_ID
  })
  const selectedSort = computed(() => (route.query.sort === 'oldest' ? 'oldest' : 'newest'))

  onUnmounted(() => {
    if (queryTimer.value) clearTimeout(queryTimer.value)
  })

  watch(
    () => route.query.q,
    (query) => {
      searchInput.value = typeof query === 'string' ? query : ''
    }
  )

  const updateQuery = async (updates: Record<string, string | undefined>) => {
    const query: Record<string, string | undefined> = {}
    Object.entries(route.query).forEach(([key, value]) => {
      if (typeof value === 'string' && value) query[key] = value
    })
    Object.assign(query, updates)
    await router.replace({ query })
  }

  watch(searchInput, (value) => {
    if (queryTimer.value) clearTimeout(queryTimer.value)
    queryTimer.value = setTimeout(() => {
      void updateQuery({ q: value.trim() || undefined })
    }, 200)
  })

  const categoryOptions = computed(() => {
    const records = savedProposals.records
    const options: Array<{ id: string; label: string }> = PROPOSAL_CATEGORIES.filter((category) =>
      records.some((record) => record.proposal.perspective === category.perspective)
    ).map((category) => ({ id: category.id, label: category.label }))

    if (records.some((record) => !record.proposal.perspective)) {
      options.push({ id: UNCATEGORIZED_PROPOSALS_CATEGORY_ID, label: '未分類' })
    }

    return [{ id: ALL_PROPOSALS_CATEGORY_ID, label: '全部' }, ...options]
  })

  const filteredRecords = computed(() => {
    const query = (typeof route.query.q === 'string' ? route.query.q : '')
      .trim()
      .toLocaleLowerCase()
    const records = savedProposals.records.filter((record) => {
      const { proposal } = record
      const matchesCategory =
        selectedCategory.value === ALL_PROPOSALS_CATEGORY_ID ||
        (selectedCategory.value === UNCATEGORIZED_PROPOSALS_CATEGORY_ID && !proposal.perspective) ||
        proposal.perspective === selectedCategory.value
      if (!matchesCategory) return false

      if (!query) return true
      const searchable = [
        proposal.title,
        proposal.summary,
        proposal.location?.name,
        proposal.location?.address
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
      return searchable.includes(query)
    })

    return [...records].sort((left, right) => {
      const direction = selectedSort.value === 'newest' ? -1 : 1
      const dateOrder = left.savedAt.localeCompare(right.savedAt)
      return dateOrder === 0
        ? left.proposal.id.localeCompare(right.proposal.id)
        : direction * dateOrder
    })
  })

  const selectCategory = (category: string) => {
    void updateQuery({ category: category === ALL_PROPOSALS_CATEGORY_ID ? undefined : category })
  }

  const selectSort = (event: Event) => {
    const target = event.target as HTMLSelectElement
    void updateQuery({ sort: target.value === 'oldest' ? 'oldest' : undefined })
  }

  const clearFilters = () => {
    if (queryTimer.value) clearTimeout(queryTimer.value)
    searchInput.value = ''
    void updateQuery({ q: undefined, category: undefined, sort: undefined })
  }

  const selectedCategoryLabel = computed(() => {
    if (selectedCategory.value === ALL_PROPOSALS_CATEGORY_ID) return '全部'
    if (selectedCategory.value === UNCATEGORIZED_PROPOSALS_CATEGORY_ID) return '未分類'
    return getProposalCategoryLabel(selectedCategory.value)
  })

  return {
    searchInput,
    selectedCategory,
    selectedSort,
    categoryOptions,
    filteredRecords,
    selectedCategoryLabel,
    selectCategory,
    selectSort,
    clearFilters
  }
}
