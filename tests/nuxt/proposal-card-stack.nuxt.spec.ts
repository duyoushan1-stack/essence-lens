import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ProposalCardStack from '../../app/components/proposal/CardStack.vue'

const proposals = [
  { title: '午後散步', description: '在附近街區慢慢走。' },
  { title: '安靜咖啡', description: '找一間光線柔和的咖啡店。' },
  { title: '黃昏取景', description: '在日落前找一個適合拍照的位置。' }
]

describe('ProposalCardStack', () => {
  it('renders up to three real proposal cards and switches the active card', async () => {
    const wrapper = await mountSuspended(ProposalCardStack, {
      props: { proposals }
    })

    expect(wrapper.findAll('[data-proposal-card]').length).toBe(3)
    expect(wrapper.find('[data-proposal-card][data-active="true"]').text()).toContain('午後散步')
    expect(wrapper.findAll('[data-proposal-card][data-active="false"]')[0]?.text()).toBe('')
    const imagePlaceholder = wrapper.find('[data-proposal-card-image]')
    expect(imagePlaceholder.exists()).toBe(true)
    expect(imagePlaceholder.classes()).toContain('h-60')
    expect(imagePlaceholder.classes()).toContain('lg:h-80')

    await wrapper.get('[aria-label="提案分頁"] button:nth-child(2)').trigger('click')

    expect(wrapper.find('[data-proposal-card][data-active="true"]').text()).toContain('安靜咖啡')
  })

  it('resets the active card when proposals change', async () => {
    const wrapper = await mountSuspended(ProposalCardStack, {
      props: { proposals }
    })

    await wrapper.get('[aria-label="提案分頁"] button:nth-child(2)').trigger('click')
    await wrapper.setProps({ proposals: [proposals[2]!, proposals[1]!] })

    expect(wrapper.find('[data-proposal-card][data-active="true"]').text()).toContain('黃昏取景')
  })
})
