import { describe, expect, it } from 'vitest'
import type { ProposalFlowStatus } from '../../app/types/proposal'
import { getProposalLayout } from '../../app/utils/proposal-animation'

describe('getProposalLayout', () => {
  it.each([
    ['idle', 'initial'],
    ['validating', 'initial'],
    ['ready', 'initial'],
    ['pending', 'focused'],
    ['rejected', 'focused'],
    ['error', 'focused'],
    ['success', 'focused']
  ] as const)('%s maps to %s', (status: ProposalFlowStatus, expected) => {
    expect(getProposalLayout(status)).toBe(expected)
  })
})
