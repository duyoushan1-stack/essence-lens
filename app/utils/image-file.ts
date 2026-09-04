const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024
const MIN_IMAGE_DIMENSION = 50
const MAX_IMAGE_DIMENSION = 4000

const readImageDimensions = (previewUrl: string) =>
  new Promise<ImageDimensions>((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('Image has no dimensions'))
        return
      }

      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }

    image.onerror = () => reject(new Error('Image could not be decoded'))
    image.src = previewUrl
  })

export const validateImageFile = async (file: File): Promise<ImageValidationResult> => {
  if (file.size === 0) {
    return { valid: false, code: 'empty-file' }
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, code: 'unsupported-type' }
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, code: 'file-too-large' }
  }

  const previewUrl = URL.createObjectURL(file)

  try {
    const dimensions = await readImageDimensions(previewUrl)

    const hasValidDimensions =
      dimensions.width >= MIN_IMAGE_DIMENSION &&
      dimensions.height >= MIN_IMAGE_DIMENSION &&
      dimensions.width <= MAX_IMAGE_DIMENSION &&
      dimensions.height <= MAX_IMAGE_DIMENSION

    if (!hasValidDimensions) {
      URL.revokeObjectURL(previewUrl)
      return { valid: false, code: 'image-dimensions-invalid' }
    }

    return { valid: true, previewUrl, dimensions }
  } catch {
    URL.revokeObjectURL(previewUrl)
    return { valid: false, code: 'invalid-image' }
  }
}
