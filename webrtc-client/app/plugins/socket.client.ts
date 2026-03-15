/**
 * socket.client.ts
 *
 * Nuxt plugin (client-only — ".client.ts" suffix).
 * Creates a single Socket.IO connection for the entire app lifetime and
 * provides it as `$socket` to every component / composable via useNuxtApp().
 *
 * Using a plugin instead of a plain module-level variable ensures:
 *  - The socket URL comes from Nuxt's runtimeConfig (env-aware).
 *  - The socket is available in SSR-safe hooks (onMounted, etc.).
 *  - There is exactly one connection shared across all pages.
 */

import { io } from 'socket.io-client'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const socket = io(config.public.signalingUrl as string, {
    autoConnect: true
  })

  socket.on('connect', () => {
    console.log('[socket] connected:', socket.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason)
  })

  return {
    provide: { socket }
  }
})
