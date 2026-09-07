import { describe, expect, it } from 'vitest'
import type { ProviderImageInput } from '../../server/providers/provider.types'
import { createImageFingerprint } from '../../server/utils/image-fingerprint'

const input: ProviderImageInput = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: 'image/jpeg',
  filename: 'sample.jpg'
}

describe('createImageFingerprint', () => {
  it('returns a stable 64-character hexadecimal fingerprint', () => {
    const fingerprint = createImageFingerprint(input)

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(createImageFingerprint(input)).toBe(fingerprint)
  })

  it('changes when payload metadata or bytes change', () => {
    const fingerprint = createImageFingerprint(input)

    expect(createImageFingerprint({ ...input, filename: 'other.jpg' })).not.toBe(fingerprint)
    expect(createImageFingerprint({ ...input, mimeType: 'image/png' })).not.toBe(fingerprint)
    expect(createImageFingerprint({ ...input, bytes: new Uint8Array([4, 5, 6]) })).not.toBe(
      fingerprint
    )
  })
})
