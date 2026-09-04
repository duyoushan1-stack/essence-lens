export interface ProposalFlowStatusInput {
  uploadStatus: ImageUploadStatus
  uploadErrorCode: ImageUploadErrorCode | null
  proposalStatus: ProposalStatus
}

export const getProposalFlowStatus = ({
  uploadStatus,
  uploadErrorCode,
  proposalStatus
}: ProposalFlowStatusInput): ProposalFlowStatus => {
  if (proposalStatus !== 'idle') {
    return proposalStatus
  }

  if (uploadStatus === 'validating') {
    return 'validating'
  }

  if (uploadStatus === 'error' || uploadErrorCode) {
    return 'rejected'
  }

  if (uploadStatus === 'ready') {
    return 'ready'
  }

  return 'idle'
}
