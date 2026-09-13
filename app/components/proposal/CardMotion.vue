<script setup lang="ts">
const props = defineProps<{
  offset: number
  active: boolean
}>()

const emit = defineEmits<{
  next: []
}>()

const cardElement = ref<HTMLElement | null>(null)
useProposalCardMotion(cardElement, toRef(props, 'active'), toRef(props, 'offset'))

const cardClass = computed(() =>
  props.active
    ? 'text-ink'
    : 'text-transparent'
)

const stackLayerClass = computed(() => {
  if (props.active) return 'z-30'
  return props.offset === 1 ? 'z-20' : 'z-10'
})

const activateCard = () => {
  if (props.active) {
    emit('next')
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.active && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    emit('next')
  }
}
</script>

<template>
  <article
    class="proposal-card-stack__card absolute inset-0 cursor-pointer rounded-[2rem]"
    :class="[stackLayerClass, !active ? 'pointer-events-none' : undefined]"
    data-proposal-card
    :data-active="active"
    :style="{ zIndex: active ? 30 : offset === 1 ? 20 : 10 }"
    :aria-hidden="!active"
    :role="active ? 'button' : undefined"
    :tabindex="active ? 0 : -1"
    @click="activateCard"
    @keydown="handleKeydown"
  >
    <div ref="cardElement" class="relative h-full w-full" :class="cardClass">
      <div
        v-if="!active"
        class="absolute inset-0 overflow-hidden rounded-[2rem] border border-white/55 bg-gradient-to-br from-white/75 via-[#dce9e5]/75 to-[#b8cfca]/70 shadow-[0_1rem_2rem_rgba(44,85,82,0.1)]"
        :class="offset === 1 ? 'opacity-80' : 'opacity-55'"
        data-proposal-card-depth
        aria-hidden="true"
      >
        <div class="absolute inset-0 bg-gradient-to-br from-white/45 via-transparent to-[#7b9f98]/20" />
      </div>

      <Transition name="proposal-card-content" mode="out-in">
        <div v-if="active" key="active" class="h-full">
          <slot />
        </div>
      </Transition>
    </div>
  </article>
</template>
