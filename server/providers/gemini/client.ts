import { GoogleGenAI } from '@google/genai'

export type GeminiClient = GoogleGenAI

/** 建立單一 Gemini SDK client；缺少 key 時交由 capability provider 回報設定錯誤。 */
export const createGeminiClient = (apiKey: string): GeminiClient | null =>
  apiKey ? new GoogleGenAI({ apiKey }) : null
