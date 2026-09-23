import type { SavedProposalRecord } from '../../shared/schemas/saved-proposal'
import { getSavedProposal } from '../services/saved-proposal.service'

export function useSavedProposalCover(record: Readonly<Ref<SavedProposalRecord | null>>) {
  const objectUrl = ref<string | null>(null)

  const revokeObjectUrl = () => {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
  }

  const loadCover = async () => {
    revokeObjectUrl()
    if (!record.value) return
    const entry = await getSavedProposal(record.value.proposal.id)
    if (entry?.coverBlob) objectUrl.value = URL.createObjectURL(entry.coverBlob)
  }

  const coverUrl = computed(() => objectUrl.value ?? record.value?.proposal.cover.imageUrl ?? null)

  onMounted(() => void loadCover())
  watch(
    () => record.value?.proposal.id,
    () => void loadCover()
  )
  onUnmounted(revokeObjectUrl)

  return { coverUrl }
}
