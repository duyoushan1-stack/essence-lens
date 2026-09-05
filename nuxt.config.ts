// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    azureContentSafetyEndpoint: '',
    azureContentSafetyApiKey: '',
    geminiApiKey: ''
  },
  modules: ['@nuxt/eslint', '@nuxt/icon', '@nuxt/test-utils/module'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()]
  },
  imports: {
    dirs: ['types']
  }
})
