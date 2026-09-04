import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ProposalResultPanel from '../../app/components/proposal/ProposalResultPanel.vue'

describe('ProposalResultPanel', () => {
  it('shows a busy state while the proposal request is pending', async () => {
    const wrapper = await mountSuspended(ProposalResultPanel, {
      props: {
        status: 'pending',
        proposals: [],
        error: null,
        rejectionReasons: []
      }
    })

    expect(wrapper.find('section').attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('正在分析圖片並產生提案，請稍候。')
  })

  it('shows rejection reasons without a retry action', async () => {
    const wrapper = await mountSuspended(ProposalResultPanel, {
      props: {
        status: 'rejected',
        proposals: [],
        error: null,
        rejectionReasons: [{ category: 'safety', code: 'sexual' }]
      }
    })

    expect(wrapper.text()).toContain('不符合內容安全條件')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('emits retry only from the error state', async () => {
    const wrapper = await mountSuspended(ProposalResultPanel, {
      props: {
        status: 'error',
        proposals: [],
        error: '目前無法產生提案，請稍後再試。',
        rejectionReasons: []
      }
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('does not render an outer panel frame around successful card results', async () => {
    const wrapper = await mountSuspended(ProposalResultPanel, {
      props: {
        status: 'success',
        proposals: [{ title: '午後散步', description: '在附近街區慢慢走。' }],
        error: null,
        rejectionReasons: []
      }
    })

    expect(wrapper.find('section').classes()).not.toContain('border')
    expect(wrapper.find('[data-proposal-card-stack]').exists()).toBe(true)
  })
})
