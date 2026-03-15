<script setup lang="ts">
/**
 * pages/room/[id].vue  –  Video Call Room
 *
 * What this page does
 * ────────────────────
 * 1. Reads the room ID from the URL parameter.
 * 2. Calls `joinRoom()` from the useWebRTC composable on mount, which:
 *      a) Requests camera + mic access.
 *      b) Registers socket listeners for WebRTC signaling.
 *      c) Emits 'join-room' to the signaling server.
 * 3. Watches the reactive localStream / remoteStream refs and assigns them
 *    as srcObject on <video> elements (Vue can't bind srcObject in templates).
 * 4. Exposes controls: mute, toggle video, hang up.
 * 5. Cleans up on unmount (closes RTCPeerConnection, stops tracks, removes
 *    socket listeners).
 *
 * Connection states
 * ─────────────────
 *  idle        → before getUserMedia
 *  waiting     → in room, no second peer yet
 *  connecting  → ICE in progress
 *  connected   → media flowing
 *  failed      → ICE failed (usually a STUN/TURN issue)
 *  disconnected / closed
 */

const route = useRoute()
const roomId = (route.params.id as string).toUpperCase()

const { $socket } = useNuxtApp() as { $socket: any }

const {
  localStream,
  remoteStream,
  connectionState,
  isMuted,
  isVideoOff,
  errorMessage,
  joinRoom,
  leaveRoom,
  toggleMute,
  toggleVideo
} = useWebRTC(roomId)

// Template refs for the two <video> elements
const localVideoEl = ref<HTMLVideoElement | null>(null)
const remoteVideoEl = ref<HTMLVideoElement | null>(null)

// srcObject cannot be set via :src binding — watch and assign manually
watch(localStream, (stream) => {
  if (localVideoEl.value) localVideoEl.value.srcObject = stream
})

watch(remoteStream, (stream) => {
  if (remoteVideoEl.value) remoteVideoEl.value.srcObject = stream
})

// Derived UI helpers
const statusLabel = computed(() => {
  switch (connectionState.value) {
    case 'idle':         return 'Starting…'
    case 'waiting':      return 'Waiting for second peer…'
    case 'connecting':   return 'Connecting…'
    case 'connected':    return 'Connected'
    case 'disconnected': return 'Disconnected'
    case 'failed':       return 'Connection failed'
    case 'closed':       return 'Call ended'
    default:             return connectionState.value
  }
})

const statusColor = computed(() => {
  if (connectionState.value === 'connected') return '#22c55e'
  if (connectionState.value === 'failed')    return '#ef4444'
  return '#f59e0b'
})

// Copied-to-clipboard feedback
const copied = ref(false)
async function copyRoomId() {
  await navigator.clipboard.writeText(roomId)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function handleHangup() {
  leaveRoom()
  navigateTo('/')
}

// Socket ID for display
const myId = ref('')
onMounted(async () => {
  myId.value = $socket.id ?? ''
  $socket.on('connect', () => { myId.value = $socket.id ?? '' })

  await joinRoom()

  // After stream is ready, assign immediately (watch may miss the first set)
  if (localVideoEl.value && localStream.value) {
    localVideoEl.value.srcObject = localStream.value
  }
})

onBeforeUnmount(() => {
  leaveRoom()
})
</script>

<template>
  <div class="room">
    <!-- ── Header ─────────────────────────────────────────── -->
    <header class="header">
      <button class="back-btn" @click="navigateTo('/')">← Back</button>

      <div class="room-id" @click="copyRoomId" title="Click to copy Room ID">
        Room: <strong>{{ roomId }}</strong>
        <span class="copy-hint">{{ copied ? '✓ Copied!' : '📋 Copy' }}</span>
      </div>

      <div class="status">
        <span class="status-dot" :style="{ background: statusColor }" />
        {{ statusLabel }}
      </div>
    </header>

    <!-- ── Error banner ───────────────────────────────────── -->
    <div v-if="errorMessage" class="error-banner">
      ⚠️ {{ errorMessage }}
    </div>

    <!-- ── Video grid ──────────────────────────────────────── -->
    <main class="video-grid" :class="{ 'has-remote': !!remoteStream }">
      <!-- Remote (large) -->
      <div class="video-tile remote-tile">
        <video
          ref="remoteVideoEl"
          autoplay
          playsinline
          class="video-el"
        />
        <div v-if="!remoteStream" class="video-placeholder">
          <span>{{ connectionState === 'waiting' ? '⏳ Waiting for peer…' : '👤 No remote video' }}</span>
        </div>
        <span class="tile-label">Remote</span>
      </div>

      <!-- Local (small picture-in-picture style) -->
      <div class="video-tile local-tile">
        <video
          ref="localVideoEl"
          autoplay
          muted
          playsinline
          class="video-el"
          :class="{ 'video-off': isVideoOff }"
        />
        <div v-if="isVideoOff" class="video-placeholder small">
          <span>📷 Camera off</span>
        </div>
        <span class="tile-label">You</span>
      </div>
    </main>

    <!-- ── Controls ────────────────────────────────────────── -->
    <footer class="controls">
      <button
        class="ctrl-btn"
        :class="{ active: isMuted }"
        @click="toggleMute"
        :title="isMuted ? 'Unmute' : 'Mute'"
      >
        {{ isMuted ? '🔇' : '🎤' }}
        <span>{{ isMuted ? 'Unmute' : 'Mute' }}</span>
      </button>

      <button
        class="ctrl-btn"
        :class="{ active: isVideoOff }"
        @click="toggleVideo"
        :title="isVideoOff ? 'Turn on camera' : 'Turn off camera'"
      >
        {{ isVideoOff ? '📷' : '📹' }}
        <span>{{ isVideoOff ? 'Start Video' : 'Stop Video' }}</span>
      </button>

      <button class="ctrl-btn hangup" @click="handleHangup" title="Leave call">
        📵
        <span>Leave</span>
      </button>
    </footer>
  </div>
</template>

<style scoped>
.room {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: #0a0a0a;
}

/* ── Header ─────────────────────────────────────────────── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: #111;
  border-bottom: 1px solid #222;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.back-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  transition: color 0.15s;
}

.back-btn:hover {
  color: #e5e5e5;
}

.room-id {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #aaa;
  cursor: pointer;
  user-select: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  transition: background 0.15s;
}

.room-id:hover {
  background: #1e1e1e;
}

.room-id strong {
  color: #e5e5e5;
  letter-spacing: 0.08em;
}

.copy-hint {
  font-size: 0.75rem;
  color: #555;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: #999;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Error ──────────────────────────────────────────────── */
.error-banner {
  background: #7f1d1d;
  color: #fca5a5;
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  text-align: center;
}

/* ── Video grid ─────────────────────────────────────────── */
.video-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  gap: 0.5rem;
  padding: 0.5rem;
  position: relative;
  overflow: hidden;
}

/* When both streams are present, lay out side by side */
.video-grid.has-remote {
  grid-template-columns: 1fr;
}

.video-tile {
  position: relative;
  background: #111;
  border-radius: 0.75rem;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Local video: small PiP in the corner */
.local-tile {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 200px;
  height: 130px;
  border: 2px solid #2e2e2e;
  border-radius: 0.625rem;
  z-index: 10;
  background: #0f0f0f;
}

/* When no remote video, make local tile full-size */
.video-grid:not(.has-remote) .local-tile {
  position: relative;
  bottom: auto;
  right: auto;
  width: 100%;
  height: 100%;
  border: none;
}

.remote-tile {
  width: 100%;
  height: 100%;
}

.video-el {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-off {
  visibility: hidden;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: #555;
  background: #111;
}

.video-placeholder.small {
  font-size: 0.75rem;
}

.tile-label {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  font-size: 0.7rem;
  color: #aaa;
  background: rgba(0,0,0,0.5);
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
}

/* ── Controls ─────────────────────────────────────────────── */
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  background: #111;
  border-top: 1px solid #222;
}

.ctrl-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  background: #1e1e1e;
  border: none;
  border-radius: 0.75rem;
  color: #e5e5e5;
  cursor: pointer;
  font-size: 1.4rem;
  padding: 0.6rem 1rem;
  min-width: 70px;
  transition: background 0.15s;
}

.ctrl-btn span {
  font-size: 0.65rem;
  color: #888;
}

.ctrl-btn:hover {
  background: #2a2a2a;
}

.ctrl-btn.active {
  background: #2e1a1a;
  color: #f87171;
}

.ctrl-btn.active span {
  color: #f87171;
}

.ctrl-btn.hangup {
  background: #7f1d1d;
  color: #fca5a5;
}

.ctrl-btn.hangup:hover {
  background: #991b1b;
}

.ctrl-btn.hangup span {
  color: #fca5a5;
}
</style>
