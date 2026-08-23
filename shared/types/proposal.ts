export interface Proposal {
  title: string
  description: string
}

export type ProposalStatus = 'idle' | 'loading' | 'success' | 'error'
