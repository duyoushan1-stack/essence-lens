interface ViewTransitionLike {
  finished: Promise<unknown>
  skipTransition: () => void
}

export function useProposalAnimation() {
  const isReducedMotion = ref(false)
  let activeTransition: ViewTransitionLike | null = null
  let mediaQuery: MediaQueryList | null = null

  const updateReducedMotion = () => {
    isReducedMotion.value = mediaQuery?.matches ?? false
  }

  const skipActiveTransition = () => {
    activeTransition?.skipTransition()
    activeTransition = null
  }

  const runLayoutTransition = async (update: () => void | Promise<void>) => {
    skipActiveTransition()

    if (isReducedMotion.value || typeof document === 'undefined') {
      await update()
      return
    }

    if (typeof document.startViewTransition !== 'function') {
      await update()
      return
    }

    const transition = document.startViewTransition(update)
    activeTransition = transition

    try {
      await transition.finished
    } finally {
      if (activeTransition === transition) {
        activeTransition = null
      }
    }
  }

  onMounted(() => {
    if (typeof window.matchMedia !== 'function') {
      return
    }

    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    updateReducedMotion()
    mediaQuery.addEventListener('change', updateReducedMotion)
  })

  onBeforeUnmount(() => {
    skipActiveTransition()
    mediaQuery?.removeEventListener('change', updateReducedMotion)
    mediaQuery = null
  })

  return {
    runLayoutTransition,
    skipActiveTransition,
    isReducedMotion: readonly(isReducedMotion)
  }
}
