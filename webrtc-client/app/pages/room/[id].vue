<script setup lang="ts">
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

// ── Pre-join screen ─────────────────────────────────────────────────────────
// Show before entering the room so user picks their media mode.
// 'camera'  → camera + mic
// 'audio'   → mic only (no camera required)
type MediaMode = 'camera' | 'audio'

const joined = ref(false)
const joining = ref(false)

async function enter(mode: MediaMode) {
  joining.value = true
  await joinRoom(mode === 'camera')
  joined.value = true
  joining.value = false

  // After stream is ready, assign immediately (watch may miss the first set)
  await nextTick()
  if (localVideoEl.value && localStream.value) {
    localVideoEl.value.srcObject = localStream.value
  }
}

// ── Video element refs ───────────────────────────────────────────────────────
const localVideoEl = ref<HTMLVideoElement | null>(null)
const remoteVideoEl = ref<HTMLVideoElement | null>(null)

watch(localStream, (stream) => {
  if (localVideoEl.value) localVideoEl.value.srcObject = stream
})
watch(remoteStream, (stream) => {
  if (remoteVideoEl.value) remoteVideoEl.value.srcObject = stream
})

// ── Derived UI ───────────────────────────────────────────────────────────────
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

onMounted(() => {
  $socket.on('connect', () => {})
})

onBeforeUnmount(() => {
  leaveRoom()
})
</script>

<template>
  <div class="room">

    <!-- ══════════════════════════════════════════════════════
         PRE-JOIN SCREEN  — pick camera+mic or mic only
         ══════════════════════════════════════════════════════ -->
    <div v-if="!joined" class="prejoin-overlay">
      <div class="prejoin-card">
        <div class="prejoin-icon">📞</div>
        <h2>Join Room <span class="room-tag">{{ roomId }}</span></h2>
        <p class="prejoin-sub">Choose how you want to join</p>

        <div class="mode-grid">
          <!-- Camera + Mic -->
          <button class="mode-btn" :disabled="joining" @click="enter('camera')">
            <span class="mode-icon">📹</span>
            <strong>Camera &amp; Mic</strong>
            <small>Video + audio call</small>
          </button>

          <!-- Audio only -->
          <button class="mode-btn" :disabled="joining" @click="enter('audio')">
            <span class="mode-icon">🎤</span>
            <strong>Mic Only</strong>
            <small>No camera required</small>
          </button>
        </div>

        <p v-if="joining" class="joining-msg">Requesting access…</p>

        <button class="cancel-link" @click="navigateTo('/')">← Back to lobby</button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════
         CALL SCREEN
         ══════════════════════════════════════════════════════ -->
    <template v-else>

      <!-- ── Header ──────────────────────────────────────── -->
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

      <!-- ── Info / warning banner ────────────────────────── -->
      <div v-if="errorMessage" class="info-banner">
        ⚠️ {{ errorMessage }}
      </div>

      <!-- ── Video grid ─────────────────────────────────── -->
      <main class="video-grid" :class="{ 'has-remote': !!remoteStream }">

        <!-- Remote (large) -->
        <div class="video-tile remote-tile">
          <video ref="remoteVideoEl" autoplay playsinline class="video-el" />
          <div v-if="!remoteStream" class="video-placeholder">
            <span>{{ connectionState === 'waiting' ? '⏳ Waiting for peer…' : '👤 No remote video' }}</span>
          </div>
          <span class="tile-label">Remote</span>
        </div>

        <!-- Local (PiP) -->
        <div class="video-tile local-tile">
          <video
            ref="localVideoEl"
            autoplay muted playsinline
            class="video-el"
            :class="{ 'video-off': isVideoOff }"
          />
          <div v-if="isVideoOff || !localStream" class="video-placeholder small">
            <span>{{ localStream ? '📷 Camera off' : '🎤 Audio only' }}</span>
          </div>
          <span class="tile-label">You</span>
        </div>

      </main>

      <!-- ── Controls ────────────────────────────────────── -->
      <footer class="controls">
        <button
          class="ctrl-btn"
          :class="{ active: isMuted }"
          @click="toggleMute"
          :disabled="!localStream"
          :title="isMuted ? 'Unmute' : 'Mute'"
        >
          {{ isMuted ? '🔇' : '🎤' }}
          <span>{{ isMuted ? 'Unmute' : 'Mute' }}</span>
        </button>

        <button
          class="ctrl-btn"
          :class="{ active: isVideoOff }"
          @click="toggleVideo"
          :disabled="!localStream"
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

    </template>
  </div>
</template>

<style scoped>
.room {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: #0a0a0a;
}

/* ══ Pre-join overlay ═══════════════════════════════════════ */
.prejoin-overlay {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.prejoin-card {
  background: #1a1a1a;
  border: 1px solid #2e2e2e;
  border-radius: 1rem;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 420px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.prejoin-icon {
  font-size: 2.5rem;
}

.prejoin-card h2 {
  font-size: 1.4rem;
  font-weight: 700;
}

.room-tag {
  display: inline-block;
  background: #2e2e2e;
  border-radius: 0.375rem;
  padding: 0.1rem 0.5rem;
  font-size: 1rem;
  letter-spacing: 0.08em;
  color: #e5e5e5;
  margin-left: 0.25rem;
}

.prejoin-sub {
  font-size: 0.875rem;
  color: #777;
  margin-top: -0.5rem;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  width: 100%;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  background: #111;
  border: 2px solid #2e2e2e;
  border-radius: 0.75rem;
  color: #e5e5e5;
  cursor: pointer;
  padding: 1.25rem 0.75rem;
  transition: border-color 0.15s, background 0.15s;
}

.mode-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  background: #0f1e3a;
}

.mode-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mode-icon {
  font-size: 2rem;
}

.mode-btn strong {
  font-size: 0.9rem;
}

.mode-btn small {
  font-size: 0.72rem;
  color: #666;
}

.joining-msg {
  font-size: 0.8rem;
  color: #888;
}

.cancel-link {
  background: none;
  border: none;
  color: #555;
  font-size: 0.8rem;
  cursor: pointer;
  margin-top: -0.25rem;
}

.cancel-link:hover {
  color: #aaa;
}

/* ══ Header ═════════════════════════════════════════════════ */
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

.back-btn:hover { color: #e5e5e5; }

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

.room-id:hover { background: #1e1e1e; }
.room-id strong { color: #e5e5e5; letter-spacing: 0.08em; }
.copy-hint { font-size: 0.75rem; color: #555; }

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

/* ══ Info banner ════════════════════════════════════════════ */
.info-banner {
  background: #1c1a08;
  color: #fde68a;
  padding: 0.5rem 1.25rem;
  font-size: 0.825rem;
  text-align: center;
  border-bottom: 1px solid #3a3000;
}

/* ══ Video grid ═════════════════════════════════════════════ */
.video-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  padding: 0.5rem;
  position: relative;
  overflow: hidden;
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

.video-grid:not(.has-remote) .local-tile {
  position: relative;
  bottom: auto;
  right: auto;
  width: 100%;
  height: 100%;
  border: none;
}

.remote-tile { width: 100%; height: 100%; }

.video-el { width: 100%; height: 100%; object-fit: cover; display: block; }
.video-off { visibility: hidden; }

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

.video-placeholder.small { font-size: 0.75rem; }

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

/* ══ Controls ═══════════════════════════════════════════════ */
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

.ctrl-btn span { font-size: 0.65rem; color: #888; }
.ctrl-btn:hover:not(:disabled) { background: #2a2a2a; }
.ctrl-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.ctrl-btn.active { background: #2e1a1a; color: #f87171; }
.ctrl-btn.active span { color: #f87171; }

.ctrl-btn.hangup { background: #7f1d1d; color: #fca5a5; }
.ctrl-btn.hangup:hover { background: #991b1b; }
.ctrl-btn.hangup span { color: #fca5a5; }
</style>
