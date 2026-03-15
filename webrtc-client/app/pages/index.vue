<script setup lang="ts">
/**
 * pages/index.vue  –  Home / Lobby
 *
 * Lets the user either:
 *  - Create a new room (generates a random ID and navigates to it), or
 *  - Join an existing room by typing its ID.
 *
 * No WebRTC or socket logic here — this page is purely navigational.
 */

const roomInput = ref('')
const error = ref('')

function generateRoomId(): string {
  // Short random alphanumeric string, easy to share verbally
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function createRoom() {
  const id = generateRoomId()
  navigateTo(`/room/${id}`)
}

function joinRoom() {
  const id = roomInput.value.trim().toUpperCase()
  if (!id) {
    error.value = 'Please enter a room ID.'
    return
  }
  error.value = ''
  navigateTo(`/room/${id}`)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') joinRoom()
}
</script>

<template>
  <main class="lobby">
    <div class="card">
      <div class="logo">
        <span class="logo-icon">📹</span>
        <h1>WebRTC POC</h1>
        <p class="subtitle">Peer-to-peer video calling — no servers in the media path</p>
      </div>

      <section class="section">
        <h2>Create a new room</h2>
        <p class="hint">Share the generated Room ID with someone else to connect.</p>
        <button class="btn btn-primary" @click="createRoom">Create Room</button>
      </section>

      <div class="divider"><span>or</span></div>

      <section class="section">
        <h2>Join an existing room</h2>
        <div class="input-row">
          <input
            v-model="roomInput"
            type="text"
            placeholder="Enter Room ID…"
            maxlength="10"
            @keydown="onKeydown"
          />
          <button class="btn btn-secondary" @click="joinRoom">Join</button>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
      </section>

      <footer class="stack-info">
        <span>Nuxt 4</span>
        <span>·</span>
        <span>Socket.IO</span>
        <span>·</span>
        <span>WebRTC</span>
        <span>·</span>
        <span>Google STUN</span>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.lobby {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 2rem;
}

.card {
  background: #1a1a1a;
  border: 1px solid #2e2e2e;
  border-radius: 1rem;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.logo {
  text-align: center;
}

.logo-icon {
  font-size: 2.5rem;
}

h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-top: 0.5rem;
}

.subtitle {
  font-size: 0.875rem;
  color: #888;
  margin-top: 0.25rem;
}

.section h2 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.hint {
  font-size: 0.8rem;
  color: #777;
  margin-bottom: 0.75rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}

.btn:hover {
  opacity: 0.85;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
  width: 100%;
  padding: 0.7rem;
}

.btn-secondary {
  background: #2e2e2e;
  color: #e5e5e5;
  white-space: nowrap;
}

.input-row {
  display: flex;
  gap: 0.5rem;
}

input {
  flex: 1;
  background: #111;
  border: 1px solid #333;
  border-radius: 0.5rem;
  color: #e5e5e5;
  font-size: 0.9rem;
  padding: 0.6rem 0.75rem;
  outline: none;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

input:focus {
  border-color: #3b82f6;
}

.error {
  font-size: 0.8rem;
  color: #f87171;
  margin-top: 0.35rem;
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #444;
  font-size: 0.8rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #2e2e2e;
}

.stack-info {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #555;
  margin-top: 0.5rem;
}
</style>
