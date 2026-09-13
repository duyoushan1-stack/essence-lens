import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ProposalCardStack from '../../app/components/proposal/CardStack.vue'
import type { Proposal } from '../../shared/types/proposal'

const createProposal = (id: string, title: string, summary: string): Proposal => ({
  id,
  title,
  summary,
  itinerary: {
    morning: { title: '早晨散步' },
    noon: { title: '午餐休息' },
    afternoon: { title: '午後慢行' }
  },
  cover: { imagePrompt: 'A calm weekend scene.', status: 'unavailable' }
})

const proposals = [
  createProposal('proposal-1', '午後散步', '在附近街區慢慢走。'),
  createProposal('proposal-2', '安靜咖啡', '找一間光線柔和的咖啡店。'),
  createProposal('proposal-3', '黃昏取景', '在日落前找一個適合拍照的位置。')
]

describe('ProposalCardStack', () => {
  it('uses a right-side expandable activity control and shows only the destination name', async () => {
    const proposal: Proposal = {
      ...proposals[0]!,
      itinerary: {
        morning: { title: '立面攝影', description: '在老街步行，拍攝街屋立面的雕飾細節。' },
        noon: { title: '街屋觀察', description: '沿街比較連續街屋的立面配置。' },
        afternoon: { title: '街景記錄', description: '選取街道透視構圖並拍照記錄。' }
      },
      location: { name: '大溪老街', address: '桃園市大溪區和平路', externalUrl: 'https://www.google.com/maps/place/Daxi' }
    }
    const wrapper = await mountSuspended(ProposalCardStack, { props: { proposals: [proposal] } })
    expect(wrapper.text()).not.toContain(proposal.location?.address)
    expect(wrapper.text()).toContain(proposal.location?.name)
    expect(wrapper.get('a.proposal-card-location').attributes('href')).toBe(proposal.location?.externalUrl)
    const toggle = wrapper.get('[data-itinerary-toggle="morning"]')
    const description = wrapper.get(`#proposal-${proposal.id}-morning-description`)
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.find('[class*="chevron-down"]').exists()).toBe(true)
    expect(description.attributes('aria-hidden')).toBe('true')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.find('[class*="chevron-up"]').exists()).toBe(true)
    expect(description.attributes('aria-hidden')).toBe('false')
    expect(description.text()).toContain(proposal.itinerary.morning.description)
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('lets the itinerary accordion fill the card space above the location button', async () => {
    const wrapper = await mountSuspended(ProposalCardStack, { props: { proposals: [proposals[0]!] } })
    const rows = wrapper.findAll('li')

    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.classes()).toContain('flex-1')
    }
  })
  it('renders up to three real proposal cards and switches the active card', async () => {
    const wrapper = await mountSuspended(ProposalCardStack, {
      props: { proposals }
    })

    expect(wrapper.findAll('[data-proposal-card]').length).toBe(3)
    expect(wrapper.find('[data-proposal-card][data-active="true"]').text()).toContain('午後散步')
    expect(wrapper.findAll('[data-proposal-card][data-active="false"]')[0]?.text()).toBe('')
    const imagePlaceholder = wrapper.find('[data-proposal-card-image]')
    expect(imagePlaceholder.exists()).toBe(true)
    expect(wrapper.find('[data-cover-source]').attributes('data-cover-source')).toBe('upload-fallback')
    expect(wrapper.findAll('[data-proposal-card-depth]')).toHaveLength(2)
    expect(wrapper.find('[data-proposal-card][data-active="true"]').classes()).toContain('z-30')
    expect(wrapper.findAll('[data-proposal-card][data-active="false"]')[0]?.classes()).toContain('z-20')
    expect(wrapper.find('[data-proposal-card][data-active="true"] .proposal-card-cover__perspective').exists()).toBe(false)
    expect(wrapper.find('[data-proposal-card][data-active="true"] .proposal-card-location').classes()).toContain('rounded-full')

    await wrapper.get('[aria-label="提案分頁"] button:nth-child(2)').trigger('click')

    expect(wrapper.find('[data-proposal-card][data-active="true"]').text()).toContain('安靜咖啡')
  })

  it('resets the active card when proposals change', async () => {
    const wrapper = await mountSuspended(ProposalCardStack, {
      props: { proposals }
    })

    await wrapper.get('[aria-label="提案分頁"] button:nth-child(2)').trigger('click')
    await wrapper.setProps({ proposals: [proposals[2]!, proposals[1]!] })

    expect(wrapper.findAll('[data-proposal-card]')).toHaveLength(2)
    expect(wrapper.find('[data-proposal-card][data-active="true"]').text()).toContain('黃昏取景')
  })
})
