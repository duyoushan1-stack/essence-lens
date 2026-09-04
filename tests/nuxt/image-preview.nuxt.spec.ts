import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ImagePreview from '../../app/components/image-upload/ImagePreview.vue'

describe('ImagePreview', () => {
  it('places generate beside remove in the image action row', async () => {
    const wrapper = await mountSuspended(ImagePreview, {
      props: {
        previewUrl: 'blob:preview',
        fileName: 'sample.jpg',
        dimensions: { width: 1200, height: 800 },
        canGenerate: true
      },
      global: {
        stubs: {
          GenerateProposalButton: {
            template: '<button type="button">生成提案</button>'
          }
        }
      }
    })

    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      '更換圖片',
      '移除',
      '生成提案'
    ])
  })
})
