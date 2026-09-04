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
    ? 'border-ink/20 bg-ink text-page shadow-xl'
    : 'pointer-events-none border-ink/10 bg-ink/10 text-transparent shadow-none'
)

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
    ref="cardElement"
    class="proposal-card-stack__card cursor-pointer absolute inset-0 flex flex-col justify-end gap-4 rounded-[2rem] border p-7 sm:p-8"
    :class="cardClass"
    data-proposal-card
    :data-active="active"
    :style="{ zIndex: active ? 3 : 3 - offset }"
    :aria-hidden="!active"
    :role="active ? 'button' : undefined"
    :tabindex="active ? 0 : -1"
    @click="activateCard"
    @keydown="handleKeydown"
  >
    <Transition name="proposal-card-content" mode="out-in">
      <div v-if="active" key="active" class="h-full">
        <slot />
      </div>
    </Transition>
  </article>
</template>
