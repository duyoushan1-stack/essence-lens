import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useProposalAnimation } from '../../app/composables/useProposalAnimation'

const createControllerHost = (onReady: (controller: unknown) => void) =>
  defineComponent({
    setup() {
      const controller = useProposalAnimation()
      onReady(controller)
      return () => h('div')
    }
  })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useProposalAnimation', () => {
  it('runs the update callback when View Transition is unavailable', async () => {
    let controller: ReturnType<typeof useProposalAnimation> | undefined
    const wrapper = await mountSuspended(
      createControllerHost((value) => {
        controller = value as ReturnType<typeof useProposalAnimation>
      })
    )
    let updated = false

    await controller?.runLayoutTransition(() => {
      updated = true
    })

    expect(updated).toBe(true)
    wrapper.unmount()
  })

  it('skips an active View Transition when explicitly cleaned up', async () => {
    let resolveFinished: (() => void) | undefined
    const skipTransition = vi.fn()
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn(() => ({
        finished: new Promise<void>((resolve) => {
          resolveFinished = resolve
        }),
        skipTransition
      }))
    })

    let controller: ReturnType<typeof useProposalAnimation> | undefined
    const wrapper = await mountSuspended(
      createControllerHost((value) => {
        controller = value as ReturnType<typeof useProposalAnimation>
      })
    )

    const request = controller?.runLayoutTransition(() => undefined)
    controller?.skipActiveTransition()
    resolveFinished?.()
    await request

    expect(skipTransition).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
