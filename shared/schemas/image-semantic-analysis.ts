import * as z from 'zod'

/** Zod schema 是語意分析的唯一資料來源。 */
export const imageSemanticAnalysisSchema = z.strictObject({
  schemaVersion: z.literal('image-semantic-analysis-v1'),
  scene: z.strictObject({
    category: z.enum(['indoor', 'outdoor', 'nature', 'urban', 'unknown']),
    recognizable: z.boolean()
  }),
  subjects: z.strictObject({
    peopleCount: z.number().int().min(0).nullable(),
    isSelfie: z.enum(['absent', 'present', 'unknown']),
    hasProductFocus: z.enum(['absent', 'present', 'unknown']),
    hasPetCloseup: z.enum(['absent', 'present', 'unknown']),
    isMemeLike: z.enum(['absent', 'present', 'unknown'])
  }),
  quality: z.strictObject({
    blur: z.enum(['none', 'mild', 'severe', 'unknown']),
    isSolidColor: z.enum(['absent', 'present', 'unknown']),
    informationSufficient: z.boolean()
  }),
  safety: z.strictObject({
    nudity: z.enum(['absent', 'present', 'unknown']),
    sexual: z.enum(['absent', 'present', 'unknown']),
    violence: z.enum(['absent', 'present', 'unknown']),
    gore: z.enum(['absent', 'present', 'unknown'])
  }),
  visualMood: z.array(z.string()).max(5),
  usefulObjects: z.array(z.string()).max(8)
})

export type ImageSemanticAnalysis = z.infer<typeof imageSemanticAnalysisSchema>

type GeminiPrimitiveType = 'string' | 'number' | 'integer' | 'boolean'

const isGeminiPrimitiveType = (value: unknown): value is GeminiPrimitiveType =>
  value === 'string' || value === 'number' || value === 'integer' || value === 'boolean'

/**
 * Gemini 僅支援 JSON Schema 的子集合。保留 Zod schema 作為唯一來源，
 * 並將 Zod 產生的等價 `const` 與 nullable `anyOf` 語法正規化。
 */
const toGeminiJsonSchema = () => {
  const jsonSchema = z.toJSONSchema(imageSemanticAnalysisSchema, {
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

      const nullableSchemas = jsonSchema.anyOf

      if (nullableSchemas?.length !== 2) {
        return
      }

      const nullableSchema = nullableSchemas.find((schema) => schema.type === 'null')
      const valueSchema = nullableSchemas.find((schema) => schema.type !== 'null')

      if (!nullableSchema || !valueSchema || !isGeminiPrimitiveType(valueSchema.type)) {
        return
      }

      Object.assign(jsonSchema, valueSchema, {
        type: [valueSchema.type, 'null']
      })
      delete jsonSchema.anyOf
    }
  })

  delete jsonSchema.$schema

  return jsonSchema
}

/** 由唯一的 Zod schema 產生、供 Gemini structured output 使用的 JSON Schema。 */
export const imageSemanticAnalysisJsonSchema = toGeminiJsonSchema()
