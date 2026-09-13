import * as z from 'zod'

const proposalActivitySchema = z.strictObject({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional()
})

export const proposalItinerarySchema = z.strictObject({
  morning: proposalActivitySchema,
  noon: proposalActivitySchema,
  afternoon: proposalActivitySchema
})

const proposalLocationSchema = z.strictObject({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1).optional(),
  externalUrl: z.url().optional()
})

const proposalCoverSchema = z.strictObject({
  imagePrompt: z.string().trim().min(1),
  imageUrl: z.url().optional(),
  status: z.enum(['unavailable', 'pending', 'ready', 'failed'])
})

export const proposalPerspectiveSchema = z.enum([
  'nature',
  'coast',
  'culture',
  'food',
  'active',
  'rest'
])

/** 對外 Proposal contract 的唯一 runtime schema。 */
export const proposalSchema = z.strictObject({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  perspective: proposalPerspectiveSchema.optional(),
  itinerary: proposalItinerarySchema,
  location: proposalLocationSchema.optional(),
  cover: proposalCoverSchema
})

export const proposalListSchema = z.array(proposalSchema).min(1).max(3)

export type Proposal = z.infer<typeof proposalSchema>
export type ProposalItinerary = z.infer<typeof proposalItinerarySchema>
export type ProposalActivity = ProposalItinerary[keyof ProposalItinerary]
export type ProposalPerspective = z.infer<typeof proposalPerspectiveSchema>
