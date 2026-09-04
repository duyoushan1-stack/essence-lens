import type { ImageSemanticAnalysis } from './image-feasibility'

export interface Proposal {
  title: string
  description: string
}

export interface ProposalContext {
  scene: ImageSemanticAnalysis['scene']
  subjects: ImageSemanticAnalysis['subjects']
  visualMood: string[]
  usefulObjects: string[]
}

export type ProposalStatus = 'idle' | 'pending' | 'rejected' | 'success' | 'error'
