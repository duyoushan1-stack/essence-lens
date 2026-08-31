import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('home page', async () => {
  await setup()

  it('renders the image upload entry point', async () => {
    const html = await $fetch('/')

    expect(html).toContain('選一張靈感圖片')
  })
})
