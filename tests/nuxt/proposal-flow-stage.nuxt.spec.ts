import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProposalFlowStage from '../../app/components/proposal/FlowStage.vue'

afterEach(() => {
  Reflect.deleteProperty(document, 'startViewTransition')
})

describe('ProposalFlowStage', () => {
  it('does not render an empty status area before generation starts', async () => {
    const wrapper = await mountSuspended(ProposalFlowStage, {
      props: { status: 'ready' },
      slots: {
        intro: '<p>Intro</p>',
        image: '<p>Image</p>',
        status: '<p>Status</p>'
      }
    })

    expect(wrapper.attributes('data-layout')).toBe('initial')
    expect(wrapper.text()).toContain('Intro')
    expect(wrapper.text()).toContain('Image')
    expect(wrapper.text()).not.toContain('Status')
  })

  it('renders the status area in the focused layout', async () => {
    const wrapper = await mountSuspended(ProposalFlowStage, {
      props: { status: 'pending' },
      slots: {
        intro: '<p>Intro</p>',
        image: '<p>Image</p>',
        status: '<p>Status</p>'
      }
    })

    expect(wrapper.attributes('data-layout')).toBe('focused')
    expect(wrapper.text()).toContain('Status')
  })

  it('keeps the initial layout when client file validation is rejected', async () => {
    const startViewTransition = vi.fn()
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition
    })

    const wrapper = await mountSuspended(ProposalFlowStage, {
      props: { status: 'rejected', keepInitialLayout: true },
      slots: {
        intro: '<p>Intro</p>',
        image: '<p>Image error</p>',
        status: '<p>Status</p>'
      }
    })

    expect(wrapper.attributes('data-layout')).toBe('initial')
    expect(wrapper.text()).toContain('Image error')
    expect(wrapper.text()).not.toContain('Status')
    expect(startViewTransition).not.toHaveBeenCalled()
  })

  it('updates the layout inside the View Transition callback', async () => {
    let updateLayout: (() => void | Promise<void>) | undefined

    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn((update: () => void | Promise<void>) => {
        updateLayout = update
        return {
          finished: Promise.resolve(),
          skipTransition: vi.fn()
        }
      })
    })

    const wrapper = await mountSuspended(ProposalFlowStage, {
      props: { status: 'ready' },
      slots: {
        intro: '<p>Intro</p>',
        image: '<p>Image</p>',
        status: '<p>Status</p>'
      }
    })

    await wrapper.setProps({ status: 'pending' })
    await wrapper.vm.$nextTick()

    expect(wrapper.attributes('data-layout')).toBe('initial')

    await updateLayout?.()
    await wrapper.vm.$nextTick()

    expect(wrapper.attributes('data-layout')).toBe('focused')
  })
})
