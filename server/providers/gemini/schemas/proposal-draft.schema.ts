import * as z from 'zod'
import { proposalPerspectiveSchema } from '../../../../shared/schemas/proposal'

const proposalDraftActivitySchema = z.strictObject({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1)
})

export const proposalDraftSchema = z.strictObject({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  perspective: proposalPerspectiveSchema,
  itinerary: z.strictObject({
    morning: proposalDraftActivitySchema,
    noon: proposalDraftActivitySchema,
    afternoon: proposalDraftActivitySchema
  }),
  locationCandidate: z.string().trim().min(1),
  cover: z.strictObject({
    imagePrompt: z.string().trim().min(1)
  })
})

export const proposalDraftListSchema = z.array(proposalDraftSchema).length(3)

const toGeminiJsonSchema = () => {
  const jsonSchema = z.toJSONSchema(proposalDraftListSchema, {
    override: ({ jsonSchema, path }) => {
      if (path.length === 0) {
        delete jsonSchema.$schema
      }

      if (Object.hasOwn(jsonSchema, 'const')) {
        const value = jsonSchema.const

        if (value !== undefined) {
          delete jsonSchema.const
          jsonSchema.enum = [value]
        }
      }
    }
  })

  delete jsonSchema.$schema

  return jsonSchema
}

/** 由 Proposal Draft Zod schema 產生、供 Gemini structured output 使用的 JSON Schema。 */
export const proposalDraftJsonSchema = toGeminiJsonSchema()
