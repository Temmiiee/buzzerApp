const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store game rooms
const rooms = new Map();

// Game state reducer
const gameReducer = (state, action) => {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'START_GAME': {
      const isFFA = action.payload.config.mode === 'ffa';
      const isSingleBuzz = action.payload.config.mode === 'single_buzz' && !!action.payload.config.designatedPlayerId;
      const isLockdown = isFFA || isSingleBuzz;
      const lockdownPeriod = action.payload.config.lockdownPeriod || 5;
      return {
        ...state,
        config: action.payload.config,
        phase: 'game',
        buzzerActive: true,
        buzzerWinner: null,
        isLockdown: isLockdown,
        lockdownTimer: isLockdown ? lockdownPeriod : 0,
      };
    }
    case 'PRESS_BUZZER': {
      if (!state.buzzerActive || state.buzzerWinner) return state;
      
      // Vérifier si le joueur peut buzzer
      const isDesignatedPlayer = state.config.designatedPlayerId === action.payload.player.id;
      const isLockdownActive = state.isLockdown && state.lockdownTimer > 0;
      
      // Le joueur désigné peut buzzer à tout moment
      // Les autres joueurs doivent attendre la fin du verrouillage
      if (isLockdownActive && !isDesignatedPlayer) {
        return state; // Refuser le buzz
      }
      
      return {
        ...state,
        buzzerActive: false,
        buzzerWinner: action.payload.player,
        isLockdown: false,
        lockdownTimer: 0,
      };
    }
    case 'RESET_ROUND': {
      const isFFA = state.config.mode === 'ffa';
      const isSingleBuzz = state.config.mode === 'single_buzz' && !!state.config.designatedPlayerId;
      const isLockdown = isFFA || isSingleBuzz;
      const lockdownPeriod = state.config.lockdownPeriod || 5;
      return {
        ...state,
        buzzerActive: true,
        buzzerWinner: null,
        phase: 'game',
        isLockdown,
        lockdownTimer: isLockdown ? lockdownPeriod : 0,
      };
    }
    case 'END_GAME':
      return {
        ...state,
        phase: 'lobby',
        buzzerActive: false,
        buzzerWinner: null,
      };
    case 'TICK_LOCKDOWN': {
      if (!state.isLockdown || state.lockdownTimer <= 0) {
        return { ...state, isLockdown: false, lockdownTimer: 0 };
      }
      const newTime = state.lockdownTimer - 1;
      return {
        ...state,
        lockdownTimer: newTime,
        isLockdown: newTime > 0,
      };
    }
    default:
      return state;
  }
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join-room', ({ roomCode, user }) => {
    socket.join(roomCode);
    // Stocker l'id du joueur et le code de la salle dans la socket
    socket.data.userId = user.id;
    socket.data.roomCode = roomCode;
    // Get or create room
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, {
        roomCode,
        players: [],
        phase: 'lobby',
        config: {
          mode: 'ffa',
          lockdownPeriod: 5,
          designatedPlayerId: null,
        },
        buzzerActive: false,
        buzzerWinner: null,
        lockdownTimer: 0,
        isLockdown: false,
      });
    }
    const room = rooms.get(roomCode);
    // Add player if not already present
    const existingPlayer = room.players.find(p => p.id === user.id);
    if (!existingPlayer) {
      room.players.push({ ...user, lastSeen: Date.now() });
      // Notify other players
      socket.to(roomCode).emit('player-joined', user);
    }
    // Send current room state to the joining player
    socket.emit('room-state', room);
    console.log(`Player ${user.name} joined room ${roomCode}`);
  });

  // Handle game actions
  socket.on('game-action', ({ roomCode, action, userId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    // Update room state
    const newState = gameReducer(room, action);
    rooms.set(roomCode, newState);

    // Broadcast to all players in the room
    io.to(roomCode).emit('room-state', newState);
    
    // Broadcast the action to other players
    socket.to(roomCode).emit('game-action', action);
  });

  // Handle player activity updates
  socket.on('player-activity', ({ roomCode, userId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === userId);
    if (player) {
      player.lastSeen = Date.now();
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Utiliser l'id du joueur et le code de la salle stockés dans la socket
    const userId = socket.data.userId;
    const roomCode = socket.data.roomCode;
    if (userId && roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      const playerIndex = room.players.findIndex(p => p.id === userId);
      if (playerIndex !== -1) {
        const removedPlayer = room.players.splice(playerIndex, 1)[0];
        // Notify other players
        socket.to(roomCode).emit('player-left', removedPlayer.id);
        // Clean up empty rooms
        if (room.players.length === 0) {
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} deleted (empty)`);
        }
        console.log(`Player ${removedPlayer.name} left room ${roomCode}`);
      }
    }
  });

  // Handle room cleanup
  socket.on('leave-room', ({ roomCode, userId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === userId);
    if (playerIndex !== -1) {
      const removedPlayer = room.players.splice(playerIndex, 1)[0];
      
      // Notify other players
      socket.to(roomCode).emit('player-left', removedPlayer.id);
      
      // Clean up empty rooms
      if (room.players.length === 0) {
        rooms.delete(roomCode);
        console.log(`Room ${roomCode} deleted (empty)`);
      }
      
      console.log(`Player ${removedPlayer.name} left room ${roomCode}`);
    }
  });
});

// Cleanup inactive players every 30 seconds
setInterval(() => {
  // No automatic cleanup - players stay connected indefinitely
  // This interval is kept for potential future features
}, 30000);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Get server info
app.get('/info', (req, res) => {
  res.json({
    name: 'Buzzer Éclair Game Server',
    version: '1.0.0',
    rooms: rooms.size,
    activeConnections: io.engine.clientsCount
  });
});

// Endpoint admin pour cleanup
app.post('/admin/cleanup', (req, res) => {
  const token = req.query.token;
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  // Déconnecte tous les sockets
  io.disconnectSockets(true);
  // Vide toutes les salles
  rooms.clear();
  res.json({ status: 'cleanup done' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Server info: http://localhost:${PORT}/info`);
}); 