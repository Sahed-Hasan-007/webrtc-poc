const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)

// Socket.IO with CORS open for development
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// rooms: Map<roomId, Set<socketId>>
const rooms = new Map()

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`)

  // ─── Join Room ──────────────────────────────────────────────────────────────
  // Client asks to join a room by its ID.
  // If the room has < 2 users: add them and notify existing peers.
  // Otherwise: reject with 'room-full'.
  socket.on('join-room', (roomId) => {
    const room = rooms.get(roomId) ?? new Set()

    if (room.size >= 2) {
      socket.emit('room-full', { roomId })
      console.log(`[!] Room ${roomId} full — rejected ${socket.id}`)
      return
    }

    room.add(socket.id)
    rooms.set(roomId, room)
    socket.join(roomId)

    // Tell the joiner which other users are already present
    const existingUsers = [...room].filter((id) => id !== socket.id)
    socket.emit('room-joined', { roomId, users: existingUsers })

    // Notify every other member that someone new arrived
    socket.to(roomId).emit('user-joined', { userId: socket.id })

    console.log(`[~] ${socket.id} joined room "${roomId}" (size: ${room.size})`)
  })

  // ─── WebRTC Signaling relay ──────────────────────────────────────────────────
  // The server is a "dumb pipe" — it just forwards SDP and ICE payloads
  // between the two peers without inspecting them.

  // Caller → Server → Callee
  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer })
  })

  // Callee → Server → Caller
  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer })
  })

  // Both directions — trickle ICE candidates
  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate })
  })

  // ─── Disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`)

    rooms.forEach((users, roomId) => {
      if (!users.has(socket.id)) return

      users.delete(socket.id)

      if (users.size === 0) {
        rooms.delete(roomId)
      } else {
        // Tell remaining peers so they can clean up their RTCPeerConnection
        socket.to(roomId).emit('user-left', { userId: socket.id })
      }

      console.log(`[~] ${socket.id} left room "${roomId}" (size: ${users.size})`)
    })
  })
})

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const roomInfo = [...rooms.entries()].map(([id, users]) => ({
    id,
    users: [...users]
  }))
  res.json({ status: 'ok', rooms: roomInfo })
})

const PORT = process.env.PORT ?? 4000
server.listen(PORT, () => {
  console.log(`Signaling server listening on http://localhost:${PORT}`)
})
