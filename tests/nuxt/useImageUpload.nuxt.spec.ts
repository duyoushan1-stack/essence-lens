import { defineComponent, h, toRaw } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let imageCanDecode = true

class TestImage {
  naturalWidth = 640
  naturalHeight = 480
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

const makeFile = (name = 'sample.jpg') => new File(['image'], name, { type: 'image/jpeg' })

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | null = null

const mountComposable = async () => {
  let state!: ReturnType<typeof useImageUpload>

  const TestComponent = defineComponent({
    setup() {
      state = useImageUpload()
      return () => h('div')
    }
  })

  wrapper = await mountSuspended(TestComponent, { route: false })

  return { state, wrapper }
}

describe('useImageUpload', () => {
  beforeEach(() => {
    imageCanDecode = true
    vi.stubGlobal('Image', TestImage)
    vi.spyOn(URL, 'createObjectURL').mockImplementation((file) => {
      return `blob:${file instanceof File ? file.name : 'sample.jpg'}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('starts idle without a file or preview', async () => {
    const { state } = await mountComposable()

    expect(state.status.value).toBe('idle')
    expect(state.file.value).toBeNull()
    expect(state.previewUrl.value).toBeNull()
    expect(state.errorCode.value).toBeNull()
  })

  it('moves a valid file to ready with a preview URL', async () => {
    const { state } = await mountComposable()
    const file = makeFile()

    await state.selectFile(file)

    expect(state.status.value).toBe('ready')
    expect(toRaw(state.file.value)).toBe(file)
    expect(state.previewUrl.value).toBe('blob:sample.jpg')
    expect(state.dimensions.value).toEqual({ width: 640, height: 480 })
  })

  it('keeps the current valid file when a replacement is invalid', async () => {
    const { state } = await mountComposable()
    const validFile = makeFile('valid.jpg')
    const invalidFile = new File(['document'], 'document.pdf', { type: 'application/pdf' })

    await state.selectFile(validFile)
    await state.selectFile(invalidFile)

    expect(state.status.value).toBe('ready')
    expect(toRaw(state.file.value)).toBe(validFile)
    expect(state.previewUrl.value).toBe('blob:valid.jpg')
    expect(state.errorCode.value).toBe('unsupported-type')
  })

  it('revokes the current preview when removing a file', async () => {
    const { state } = await mountComposable()

    await state.selectFile(makeFile())
    state.removeFile()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sample.jpg')
    expect(state.status.value).toBe('idle')
    expect(state.file.value).toBeNull()
    expect(state.previewUrl.value).toBeNull()
  })

  it('revokes the current preview when the component unmounts', async () => {
    const { state, wrapper: mountedWrapper } = await mountComposable()

    await state.selectFile(makeFile())
    mountedWrapper.unmount()
    wrapper = null

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sample.jpg')
  })
})
