import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveProposal } from '../../app/services/saved-proposal.service'
import type { Proposal } from '../../shared/types/proposal'

const storage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn()
}))

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => ({})),
  del: vi.fn(),
  get: storage.get,
  keys: vi.fn(),
  set: storage.set
}))

const proposal: Proposal = {
  id: 'proposal-with-cover',
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

describe('saveProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.get.mockResolvedValue(undefined)
    storage.set.mockResolvedValue(undefined)
    vi.stubGlobal('indexedDB', {})
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['cover'], { type: 'image/jpeg' }))
      })
    )
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves a proposal when no previous record exists', async () => {
    const proposalWithoutCover: Proposal = {
      ...proposal,
      cover: { imagePrompt: proposal.cover.imagePrompt, status: 'unavailable' }
    }

    const result = await saveProposal(proposalWithoutCover)

    expect(result.coverStatus).toBe('not-requested')
    expect(result.entry.record.proposal.id).toBe(proposal.id)
    expect(storage.set).toHaveBeenCalledOnce()
  })

  it('saves the proposal when its cover cannot be decoded or optimized', async () => {
    storage.get.mockResolvedValue({
      record: {
        schemaVersion: 1,
        proposal,
        savedAt: '2026-09-18T08:00:00.000Z',
        updatedAt: '2026-09-18T08:00:00.000Z',
        customCategoryIds: []
      }
    })

    const result = await saveProposal(proposal)

    expect(result.coverStatus).toBe('unavailable')
    expect(result.entry.record.proposal.id).toBe(proposal.id)
    expect(storage.set).toHaveBeenCalledOnce()
  })
})
