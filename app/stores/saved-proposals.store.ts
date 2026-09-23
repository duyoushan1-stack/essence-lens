import { defineStore } from 'pinia'
import type { Proposal } from '../../shared/types/proposal'
import type { SavedProposalRecord } from '../../shared/schemas/saved-proposal'
import {
  listSavedProposals,
  removeSavedProposal,
  saveProposal
} from '../services/saved-proposal.service'

export const useSavedProposalsStore = defineStore('savedProposals', () => {
  const records = ref<SavedProposalRecord[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref<string | null>(null)
  const pendingIds = ref<string[]>([])
  let loadPromise: Promise<void> | null = null

  const count = computed(() => records.value.length)
  const initialized = computed(() => status.value === 'ready')
  const isPending = (proposalId: string) => pendingIds.value.includes(proposalId)
  const isSaved = (proposalId: string) =>
    records.value.some((record) => record.proposal.id === proposalId)

  const load = async () => {
    if (status.value === 'ready' || loadPromise) return loadPromise

    status.value = 'loading'
    error.value = null
    loadPromise = listSavedProposals()
      .then((result) => {
        records.value = result.entries.map((entry) => entry.record)
        status.value = 'ready'
        const skippedCount = result.invalidRecordCount + result.unsupportedVersionCount
        if (skippedCount) {
          const details = [
            result.invalidRecordCount ? `${result.invalidRecordCount} 筆格式異常` : '',
            result.unsupportedVersionCount ? `${result.unsupportedVersionCount} 筆版本不支援` : ''
          ].filter(Boolean)
          error.value = `有收藏資料無法顯示（${details.join('、')}），原始資料已保留。`
        }
      })
      .catch(() => {
        status.value = 'error'
        error.value = '目前無法讀取收藏，請重新整理後再試。'
      })
      .finally(() => {
        loadPromise = null
      })

    return loadPromise
  }

  const save = async (proposal: Proposal, fallbackImageUrl?: string | null): Promise<boolean> => {
    if (isPending(proposal.id)) return false

    pendingIds.value = [...pendingIds.value, proposal.id]
    error.value = null
    try {
      const result = await saveProposal(proposal, fallbackImageUrl)
      const nextRecords = records.value.filter((record) => record.proposal.id !== proposal.id)
      records.value = [result.entry.record, ...nextRecords].sort((left, right) =>
        right.savedAt.localeCompare(left.savedAt)
      )
      if (result.coverStatus === 'unavailable' && !result.entry.record.proposal.cover.imageUrl) {
        error.value = '提案已收藏，但封面無法保存到此瀏覽器。'
      }
      return true
    } catch {
      error.value = '收藏未儲存，請再試一次。'
      return false
    } finally {
      pendingIds.value = pendingIds.value.filter((id) => id !== proposal.id)
    }
  }

  const remove = async (proposalId: string): Promise<boolean> => {
    if (isPending(proposalId)) return false

    pendingIds.value = [...pendingIds.value, proposalId]
    error.value = null
    try {
      await removeSavedProposal(proposalId)
      records.value = records.value.filter((record) => record.proposal.id !== proposalId)
      return true
    } catch {
      error.value = '收藏未移除，請再試一次。'
      return false
    } finally {
      pendingIds.value = pendingIds.value.filter((id) => id !== proposalId)
    }
  }

  const getRecord = (proposalId: string) =>
    records.value.find((record) => record.proposal.id === proposalId) ?? null

  const dismissError = () => {
    error.value = null
  }

  return {
    records,
    status: readonly(status),
    error: readonly(error),
    count,
    initialized,
    isPending,
    isSaved,
    load,
    save,
    remove,
    getRecord,
    dismissError
  }
})
