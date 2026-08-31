import type { Proposal } from '../../shared/types/proposal'
import { beforeAll, describe, expect, it, vi } from 'vitest'

type ProposalHandler = typeof import('../../server/api/proposal.post').default

let proposalHandler: ProposalHandler

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: () => Proposal) => handler)

  const apiModule = await import('../../server/api/proposal.post')
  proposalHandler = apiModule.default
})

describe('POST /api/proposal', () => {
  it('returns the typed mock proposal', async () => {
    const response = await proposalHandler({} as Parameters<ProposalHandler>[0])

    expect(response).toEqual<Proposal>({
      title: '午後散步與咖啡',
      description: '到附近街區散步，再找一間安靜的咖啡店休息。'
    })
  })
})
