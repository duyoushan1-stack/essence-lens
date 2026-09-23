<script setup lang="ts">
import BaseToast from './components/base/Toast.vue'

const savedProposals = useSavedProposalsStore()

onMounted(() => {
  void savedProposals.load()
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <LayoutFloatingNav />
  <BaseToast
    :message="savedProposals.error"
    :retryable="savedProposals.status === 'error'"
    @retry="savedProposals.load"
    @dismiss="savedProposals.dismissError"
  />
  <NuxtPage />
</template>
