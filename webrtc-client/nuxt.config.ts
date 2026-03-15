// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Expose the signaling server URL to the browser via useRuntimeConfig()
  runtimeConfig: {
    public: {
      signalingUrl: process.env.NUXT_PUBLIC_SIGNALING_URL ?? 'http://localhost:4000'
    }
  }
})
