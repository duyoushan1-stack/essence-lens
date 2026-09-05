import type { AnalyzeSafety, ProviderImageInput } from './provider.types'

export const analyzeImageSafety: AnalyzeSafety = async (
  _input: ProviderImageInput
): Promise<ContentSafetyAssessment> => {
  throw new Error('Azure Content Safety provider is not connected')
}
