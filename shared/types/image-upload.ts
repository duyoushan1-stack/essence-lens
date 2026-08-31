export type ImageUploadStatus = 'idle' | 'validating' | 'ready' | 'error'

export type ImageUploadErrorCode =
  'empty-file' | 'unsupported-type' | 'file-too-large' | 'invalid-image'

export interface ImageDimensions {
  width: number
  height: number
}

export interface ImageUploadState {
  file: File | null
  previewUrl: string | null
  dimensions: ImageDimensions | null
  status: ImageUploadStatus
  errorCode: ImageUploadErrorCode | null
}

export type ImageValidationResult =
  | {
      valid: true
      previewUrl: string
      dimensions: ImageDimensions
    }
  | {
      valid: false
      code: ImageUploadErrorCode
    }
