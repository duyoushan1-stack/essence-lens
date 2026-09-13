import { useMotion, useReducedMotion, type Variant } from '@vueuse/motion'

const getTransition = (reducedMotion: boolean) =>
  reducedMotion
    ? { type: 'tween' as const, duration: 0 }
    : { type: 'spring' as const, stiffness: 140, damping: 24, mass: 1 }

export const getProposalCardVariant = (
  active: boolean,
  offset: number,
  reducedMotion: boolean
): Variant => {
  if (active) {
    return {
      x: 0,
      y: 0,
      rotate: 0,
      scale: 1,
      opacity: 1,
      transition: getTransition(reducedMotion)
    }
  }

  const direction = offset % 2 === 0 ? -1 : 1

  return {
    x: direction * (22 + offset * 4),
    y: -offset * 14,
    rotate: direction * (4 + offset * 1.5),
    scale: 1 - offset * 0.05,
    opacity: Math.max(0.36, 0.7 - offset * 0.12),
    transition: getTransition(reducedMotion)
  }
}

export function useProposalCardMotion(
  cardElement: Ref<HTMLElement | null>,
  active: Readonly<Ref<boolean>>,
  offset: Readonly<Ref<number>>
) {
  const reducedMotion = useReducedMotion()
  const motion = useMotion(cardElement)
  const cardVariant = computed(() =>
    getProposalCardVariant(active.value, offset.value, reducedMotion.value)
  )

  const applyCardMotion = async () => {
    const transition = motion.apply(cardVariant.value)

    if (transition) {
      await transition
    }
  }

  watch(cardVariant, () => {
    void applyCardMotion()
  })

  onMounted(() => {
    void applyCardMotion()
  })

  onBeforeUnmount(() => {
    motion.stop()
  })

  return {
    cardVariant,
    applyCardMotion,
    reducedMotion: readonly(reducedMotion)
  }
}
