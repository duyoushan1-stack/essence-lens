import { describe, expect, it } from 'vitest'
import { savedProposalRecordSchema } from '../../shared/schemas/saved-proposal'
import { getProposalCategoryLabel } from '../../app/constants/proposal-categories'

const proposal = {
  id: 'proposal-1',
  title: '山邊的午後',
  summary: '留一段時間給安靜的風景。',
  perspective: 'nature' as const,
  itinerary: {
    morning: { title: '慢慢散步' },
    noon: { title: '找一間小店' },
    afternoon: { title: '看一會兒雲' }
  },
  cover: {
    imagePrompt: 'A quiet green hillside',
    status: 'unavailable' as const
  }
}

describe('saved proposal contract', () => {
  it('accepts a saved proposal with no custom categories', () => {
    const record = savedProposalRecordSchema.parse({
      schemaVersion: 1,
      proposal,
      savedAt: '2026-09-18T08:00:00.000Z',
      updatedAt: '2026-09-18T08:00:00.000Z',
      customCategoryIds: []
    })

    expect(record.proposal.id).toBe('proposal-1')
    expect(getProposalCategoryLabel(record.proposal.perspective)).toBe('自然')
  })

  it('keeps missing perspective as an uncategorized proposal', () => {
    expect(getProposalCategoryLabel(undefined)).toBe('未分類')
  })
})
