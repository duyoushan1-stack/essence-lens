<script setup lang="ts">
const props = defineProps<{
  status: ProposalFlowStatus
  keepInitialLayout?: boolean
}>()

const layout = computed(() =>
  props.keepInitialLayout ? 'initial' : getProposalLayout(props.status)
)
const renderedLayout = ref(layout.value)
const animation = useProposalAnimation()

const imagePlacementClass = computed(() =>
  renderedLayout.value === 'focused' ? 'lg:col-start-1' : 'lg:col-start-2'
)

watch(
  layout,
  (nextLayout) => {
    void animation.runLayoutTransition(async () => {
      renderedLayout.value = nextLayout
      await nextTick()
    })
  },
  { flush: 'pre' }
)
</script>

<template>
  <div
    class="proposal-flow-stage mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:gap-24"
    :class="`proposal-flow-stage--${renderedLayout}`"
    :data-layout="renderedLayout"
    :data-flow-status="status"
  >
    <section
      class="proposal-flow-stage__intro min-w-0 lg:col-start-1 lg:row-start-1"
      aria-live="polite"
    >
      <slot name="intro" />
    </section>

    <section class="proposal-flow-stage__image min-w-0 lg:row-start-1" :class="imagePlacementClass">
      <slot name="image" />
    </section>

    <section
      v-if="renderedLayout === 'focused'"
      class="proposal-flow-stage__status min-w-0 lg:col-start-2 lg:row-start-1"
    >
      <slot name="status" />
    </section>
  </div>
</template>
