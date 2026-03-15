/**
 * useWebRTC.ts
 *
 * Composable that owns all WebRTC state and logic for one call session.
 *
 * Responsibilities
 * ─────────────────
 * 1. Capture local camera + microphone via getUserMedia.
 * 2. Create an RTCPeerConnection with Google's free STUN servers.
 * 3. Exchange SDP offer/answer and trickle ICE candidates through the
 *    Socket.IO signaling server (see webrtc-server/index.js).
 * 4. Expose reactive refs so the room page can bind video elements and
 *    show connection status.
 *
 * Signaling flow
 * ──────────────
 *   Peer A (already in room)          Server          Peer B (joins later)
 *        │                              │                      │
 *        │ ←── user-joined(B) ──────────│                      │
 *        │                              │                      │
 *        │  createOffer()               │                      │
 *        │ ──── offer(to: B) ──────────►│──── offer(from:A) ──►│
 *        │                              │                      │
 *        │                              │  createAnswer()      │
 *        │◄─── answer(from: B) ─────────│◄─── answer(to:A) ────│
 *        │                              │                      │
 *        │◄═══ ICE candidates (both directions, trickle) ══════│
 *        │                              │                      │
 *        │◄══════════════ P2P media stream ════════════════════│
 */

import type { Socket } from 'socket.io-client'

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}

export function useWebRTC(roomId: string) {
  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)
  const connectionState = ref<RTCPeerConnectionState | 'idle' | 'waiting'>('idle')
  const isMuted = ref(false)
  const isVideoOff = ref(false)
  const errorMessage = ref<string | null>(null)

  // Set by the signaling exchange so ICE candidates know where to go
  let remoteUserId: string | null = null
  let pc: RTCPeerConnection | null = null

  const { $socket } = useNuxtApp() as { $socket: Socket }

  // ─── Media ────────────────────────────────────────────────────────────────

  async function initLocalStream() {
    try {
      localStream.value = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      })
    } catch (err) {
      errorMessage.value =
        'Camera/microphone access denied. Please allow permissions and reload.'
      throw err
    }
  }

  // ─── RTCPeerConnection ────────────────────────────────────────────────────

  function createPeerConnection(): RTCPeerConnection {
    const connection = new RTCPeerConnection(ICE_CONFIG)

    // Add every local track to the connection so the remote peer gets them
    localStream.value
      ?.getTracks()
      .forEach((track) => connection.addTrack(track, localStream.value!))

    // When the remote peer adds its tracks, capture them as the remoteStream
    connection.ontrack = (event) => {
      remoteStream.value = event.streams[0] ?? null
    }

    // Trickle ICE: send each candidate to the remote peer as it's discovered
    connection.onicecandidate = (event) => {
      if (event.candidate && remoteUserId) {
        $socket.emit('ice-candidate', {
          to: remoteUserId,
          candidate: event.candidate
        })
      }
    }

    // Keep the UI in sync with the connection lifecycle
    connection.onconnectionstatechange = () => {
      connectionState.value = connection.connectionState
    }

    pc = connection
    return connection
  }

  // ─── Caller side (Peer A) ─────────────────────────────────────────────────

  async function createOffer(targetUserId: string) {
    remoteUserId = targetUserId
    const connection = createPeerConnection()

    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer)

    $socket.emit('offer', { to: targetUserId, offer })
    connectionState.value = 'waiting'
  }

  // ─── Callee side (Peer B) ─────────────────────────────────────────────────

  async function handleOffer(from: string, offer: RTCSessionDescriptionInit) {
    remoteUserId = from
    const connection = createPeerConnection()

    await connection.setRemoteDescription(offer)
    const answer = await connection.createAnswer()
    await connection.setLocalDescription(answer)

    $socket.emit('answer', { to: from, answer })
  }

  async function handleAnswer(answer: RTCSessionDescriptionInit) {
    await pc?.setRemoteDescription(answer)
  }

  async function handleIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      await pc?.addIceCandidate(candidate)
    } catch {
      // Benign: may arrive before setRemoteDescription in some edge cases
    }
  }

  // ─── Controls ─────────────────────────────────────────────────────────────

  function toggleMute() {
    const track = localStream.value?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    isMuted.value = !track.enabled
  }

  function toggleVideo() {
    const track = localStream.value?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    isVideoOff.value = !track.enabled
  }

  function hangup() {
    pc?.close()
    pc = null
    localStream.value?.getTracks().forEach((t) => t.stop())
    localStream.value = null
    remoteStream.value = null
    remoteUserId = null
    connectionState.value = 'idle'
  }

  // ─── Room lifecycle ───────────────────────────────────────────────────────

  async function joinRoom() {
    await initLocalStream()

    $socket.emit('join-room', roomId)

    // Server confirms we're in; `users` = list of already-present socket IDs.
    // We don't need to do anything here — we wait for Peer A to send an offer.
    $socket.on('room-joined', ({ users }: { users: string[] }) => {
      if (users.length === 0) {
        connectionState.value = 'waiting'
      }
    })

    // Peer A: notified when Peer B joins — we initiate the offer
    $socket.on('user-joined', async ({ userId }: { userId: string }) => {
      await createOffer(userId)
    })

    // Peer B: receives offer from Peer A
    $socket.on(
      'offer',
      async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
        await handleOffer(from, offer)
      }
    )

    // Peer A: receives answer from Peer B
    $socket.on(
      'answer',
      async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        await handleAnswer(answer)
      }
    )

    // Both sides: receive trickle ICE candidates from the other peer
    $socket.on(
      'ice-candidate',
      async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        await handleIceCandidate(candidate)
      }
    )

    // The other peer disconnected — clean up the remote side
    $socket.on('user-left', () => {
      remoteStream.value = null
      pc?.close()
      pc = null
      remoteUserId = null
      connectionState.value = 'waiting'
    })

    // Room was already full when we tried to join
    $socket.on('room-full', () => {
      errorMessage.value = 'Room is full (max 2 participants).'
      hangup()
    })
  }

  function leaveRoom() {
    hangup()
    // Remove all listeners so they don't fire on the next room visit
    ;[
      'room-joined',
      'user-joined',
      'offer',
      'answer',
      'ice-candidate',
      'user-left',
      'room-full'
    ].forEach((event) => $socket.off(event))
  }

  return {
    localStream,
    remoteStream,
    connectionState,
    isMuted,
    isVideoOff,
    errorMessage,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleVideo,
    hangup
  }
}
