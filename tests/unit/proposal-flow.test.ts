import { describe, expect, it } from 'vitest'
import type { ImageUploadErrorCode, ImageUploadStatus } from '../../shared/types/image-upload'
import type { ProposalStatus } from '../../app/types/proposal'
import { getProposalFlowStatus } from '../../app/utils/proposal-flow'

const getStatus = (
  uploadStatus: ImageUploadStatus,
  proposalStatus: ProposalStatus = 'idle',
  uploadErrorCode: ImageUploadErrorCode | null = null
) => getProposalFlowStatus({ uploadStatus, proposalStatus, uploadErrorCode })

describe('getProposalFlowStatus', () => {
  it.each([
    ['idle', 'idle', null, 'idle'],
    ['validating', 'idle', null, 'validating'],
    ['ready', 'idle', null, 'ready'],
    ['error', 'idle', null, 'rejected'],
    ['ready', 'pending', null, 'pending'],
    ['ready', 'rejected', null, 'rejected'],
    ['ready', 'error', null, 'error'],
    ['ready', 'success', null, 'success']
  ] as const)('%s + %s maps to %s', (uploadStatus, proposalStatus, uploadErrorCode, expected) => {
    expect(getStatus(uploadStatus, proposalStatus, uploadErrorCode)).toBe(expected)
  })

  it('maps a local upload error code to rejected even when the upload composable preserves ready', () => {
    expect(getStatus('ready', 'idle', 'unsupported-type')).toBe('rejected')
  })
})
