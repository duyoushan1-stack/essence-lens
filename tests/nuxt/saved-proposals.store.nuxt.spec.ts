import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalSavedProposalEntry } from '../../shared/schemas/saved-proposal'
import type { Proposal } from '../../shared/types/proposal'
import { useSavedProposalsStore } from '../../app/stores/saved-proposals.store'

const service = vi.hoisted(() => ({
  listSavedProposals: vi.fn(),
  removeSavedProposal: vi.fn(),
  saveProposal: vi.fn()
}))

vi.mock('../../app/services/saved-proposal.service', () => service)

const proposal: Proposal = {
  id: 'proposal-with-remote-cover',
  title: '山邊的午後',
  summary: '留一段時間給安靜的風景。',
  perspective: 'nature',
  itinerary: {
    morning: { title: '慢慢散步' },
    noon: { title: '找一間小店' },
    afternoon: { title: '看一會兒雲' }
  },
  cover: {
    imagePrompt: 'A quiet green hillside',
    imageUrl: 'https://images.example.com/cover.jpg',
    status: 'ready'
  }
}

const createEntry = (value: Proposal): LocalSavedProposalEntry => ({
  record: {
    schemaVersion: 1,
    proposal: value,
    savedAt: '2026-09-18T08:00:00.000Z',
    updatedAt: '2026-09-18T08:00:00.000Z',
    customCategoryIds: []
  }
})

describe('saved proposals store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    service.listSavedProposals.mockResolvedValue({
      entries: [],
      invalidRecordCount: 0,
      unsupportedVersionCount: 0
    })
    service.removeSavedProposal.mockResolvedValue(undefined)
    service.saveProposal.mockResolvedValue({
      entry: createEntry(proposal),
      coverStatus: 'unavailable'
    })
  })

  it('does not report an error when the remote cover remains available as fallback', async () => {
    const savedProposals = useSavedProposalsStore()
    await savedProposals.load()

    const saved = await savedProposals.save(proposal)

    expect(saved).toBe(true)
    expect(savedProposals.isSaved(proposal.id)).toBe(true)
    expect(savedProposals.error).toBeNull()
  })

  it('reports an unavailable cover when no remote fallback exists', async () => {
    const proposalWithoutCover: Proposal = {
      ...proposal,
      cover: { imagePrompt: proposal.cover.imagePrompt, status: 'unavailable' }
    }
    service.saveProposal.mockResolvedValueOnce({
      entry: createEntry(proposalWithoutCover),
      coverStatus: 'unavailable'
    })
    const savedProposals = useSavedProposalsStore()
    await savedProposals.load()

    await savedProposals.save(proposalWithoutCover)

    expect(savedProposals.error).toBe('提案已收藏，但封面無法保存到此瀏覽器。')
  })
})
