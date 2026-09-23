import * as z from 'zod'
import { proposalSchema } from './proposal'

export const savedProposalRecordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  proposal: proposalSchema,
  savedAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  customCategoryIds: z.array(z.string().trim().min(1))
})

export type SavedProposalRecord = z.infer<typeof savedProposalRecordSchema>

export interface LocalSavedProposalEntry {
  record: SavedProposalRecord
  coverBlob?: Blob
}
