import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import BaseToast from '../../app/components/base/Toast.vue'

describe('BaseToast', () => {
  it('shows the message and emits retry and dismiss actions', async () => {
    const wrapper = await mountSuspended(BaseToast, {
      props: { message: '收藏暫時無法讀取。', retryable: true }
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('收藏暫時無法讀取。')
    await wrapper.get('button').trigger('click')
    await wrapper.get('[aria-label="關閉通知"]').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('renders nothing without a message', async () => {
    const wrapper = await mountSuspended(BaseToast, {
      props: { message: null, retryable: false }
    })

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
