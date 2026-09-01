import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validateImageFile } from '../../app/utils/image-file'

let imageCanDecode = true
let imageDimensions = { width: 640, height: 480 }

class TestImage {
  get naturalWidth() {
    return imageDimensions.width
  }

  get naturalHeight() {
    return imageDimensions.height
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(_value: string) {
    queueMicrotask(() => {
      if (imageCanDecode) {
        this.onload?.()
        return
      }

      this.onerror?.()
    })
  }
}

const makeFile = (type = 'image/jpeg') => new File(['image'], 'sample.jpg', { type })

describe('validateImageFile', () => {
  beforeEach(() => {
    imageCanDecode = true
    imageDimensions = { width: 640, height: 480 }
    vi.stubGlobal('Image', TestImage)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:sample'),
      revokeObjectURL: vi.fn()
    })
  })

  it('accepts supported images and returns preview data', async () => {
    const result = await validateImageFile(makeFile())

    expect(result).toEqual({
      valid: true,
      previewUrl: 'blob:sample',
      dimensions: { width: 640, height: 480 }
    })
  })

  it('rejects unsupported MIME types before creating a preview', async () => {
    const result = await validateImageFile(makeFile('application/pdf'))

    expect(result).toEqual({ valid: false, code: 'unsupported-type' })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('rejects empty files', async () => {
    const file = new File([], 'empty.jpg', { type: 'image/jpeg' })

    const result = await validateImageFile(file)

    expect(result).toEqual({ valid: false, code: 'empty-file' })
  })

  it('rejects files over the size limit', async () => {
    const file = makeFile()
    Object.defineProperty(file, 'size', { value: 4 * 1024 * 1024 + 1 })

    const result = await validateImageFile(file)

    expect(result).toEqual({ valid: false, code: 'file-too-large' })
  })

  it('rejects images outside the supported dimensions', async () => {
    imageDimensions = { width: 4001, height: 480 }

    const result = await validateImageFile(makeFile())

    expect(result).toEqual({ valid: false, code: 'image-dimensions-invalid' })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sample')
  })

  it('accepts images at the maximum supported dimensions', async () => {
    imageDimensions = { width: 4000, height: 4000 }

    const result = await validateImageFile(makeFile())

    expect(result).toEqual({
      valid: true,
      previewUrl: 'blob:sample',
      dimensions: { width: 4000, height: 4000 }
    })
  })

  it('rejects images smaller than the supported dimensions', async () => {
    imageDimensions = { width: 49, height: 480 }

    const result = await validateImageFile(makeFile())

    expect(result).toEqual({ valid: false, code: 'image-dimensions-invalid' })
  })

  it('revokes the preview URL when the image cannot be decoded', async () => {
    imageCanDecode = false

    const result = await validateImageFile(makeFile())

    expect(result).toEqual({ valid: false, code: 'invalid-image' })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sample')
  })
})
