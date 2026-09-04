export type ProposalLayout = 'initial' | 'focused'

export const getProposalLayout = (status: ProposalFlowStatus): ProposalLayout =>
  status === 'pending' || status === 'rejected' || status === 'error' || status === 'success'
    ? 'focused'
    : 'initial'
