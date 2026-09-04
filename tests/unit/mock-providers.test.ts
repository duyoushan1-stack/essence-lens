import { describe, expect, it } from 'vitest'
import { createMockProposalProviders } from '../../server/clients/mock-providers'

describe('createMockProposalProviders', () => {
  it('returns safe, policy-compatible data for the local development pipeline', async () => {
    const providers = createMockProposalProviders()
    const input = {
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/jpeg',
      filename: 'sample.jpg'
    }

    const safety = await providers.analyzeSafety(input)
    const semantics = await providers.analyzeSemantics(input)
    const proposals = await providers.generateProposal({
      scene: semantics.scene,
      subjects: semantics.subjects,
      visualMood: semantics.visualMood,
      usefulObjects: semantics.usefulObjects
    })

    expect(Object.values(safety.categories).every((severity) => severity === 0)).toBe(true)
    expect(semantics.quality.informationSufficient).toBe(true)
    expect(proposals).toHaveLength(3)
  })
})
