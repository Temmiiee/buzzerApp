import { io, Socket } from 'socket.io-client';
import { type AppState, type Player, type Action } from '@/types';

// Server configuration
const SERVER_URLS = [
  'https://buzzer-game-server-ox2h.onrender.com', // Production server
  'http://localhost:3001', // Local development server
];

// Remote game service for internet-based multiplayer
export class RemoteGameService {
  private socket: Socket | null = null;
  private roomCode: string;
  private userId: string;
  private user: Player;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private currentServerIndex = 0;
  private currentState: AppState | null = null;

  constructor(roomCode: string, userId: string, user: Player) {
    this.roomCode = roomCode;
    this.userId = userId;
    this.user = user;
  }

  // Connect to the game server
  async connect(): Promise<AppState> {
    return new Promise((resolve, reject) => {
      this.tryConnect(resolve, reject);
    });
  }

  // Try to connect to different servers
  private tryConnect(resolve: (state: AppState) => void, reject: (error: any) => void): void {
    if (this.currentServerIndex >= SERVER_URLS.length) {
      reject(new Error('All servers are unavailable'));
      return;
    }

    const serverUrl = SERVER_URLS[this.currentServerIndex];
    console.log(`Attempting to connect to: ${serverUrl}`);

    try {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
      });

      this.socket.on('connect', () => {
        console.log(`Connected to game server: ${serverUrl}`);
        this.reconnectAttempts = 0;
        
        // Join the room
        this.socket!.emit('join-room', {
          roomCode: this.roomCode,
          user: this.user,
        });
      });

      this.socket.on('room-state', (state: AppState) => {
        this.currentState = state;
        this.notifyStateChange(state);
        resolve(state);
      });

      this.socket.on('player-joined', (player: Player) => {
        this.notifyPlayerJoin(player);
      });

      this.socket.on('player-left', (playerId: string) => {
        this.notifyPlayerLeave(playerId);
      });

      this.socket.on('game-action', (action: Action) => {
        this.notifyGameAction(action);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from game server');
        this.handleReconnect();
      });

      this.socket.on('connect_error', (error) => {
        console.error(`Connection error to ${serverUrl}:`, error);
        this.tryNextServer(resolve, reject);
      });

    } catch (error) {
      console.error(`Failed to connect to ${serverUrl}:`, error);
      this.tryNextServer(resolve, reject);
    }
  }

  // Try next server in the list
  private tryNextServer(resolve: (state: AppState) => void, reject: (error: any) => void): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.currentServerIndex++;
    setTimeout(() => {
      this.tryConnect(resolve, reject);
    }, 1000);
  }

  // Dispatch game action
  dispatchAction(action: Action): void {
    if (this.socket?.connected) {
      this.socket.emit('game-action', {
        roomCode: this.roomCode,
        action,
        userId: this.userId,
      });
    }
  }

  // Update player activity
  updateActivity(): void {
    if (this.socket?.connected) {
      this.socket.emit('player-activity', {
        roomCode: this.roomCode,
        userId: this.userId,
      });
    }
  }

  // Subscribe to state changes
  subscribe(callback: (state: AppState) => void): () => void {
    if (!this.listeners.has('state-change')) {
      this.listeners.set('state-change', new Set());
    }
    this.listeners.get('state-change')!.add(callback);

    return () => {
      this.listeners.get('state-change')?.delete(callback);
    };
  }

  // Subscribe to player events
  subscribeToPlayerEvents(
    onPlayerJoin: (player: Player) => void,
    onPlayerLeave: (playerId: string) => void
  ): () => void {
    if (!this.listeners.has('player-join')) {
      this.listeners.set('player-join', new Set());
    }
    if (!this.listeners.has('player-leave')) {
      this.listeners.set('player-leave', new Set());
    }

    this.listeners.get('player-join')!.add(onPlayerJoin);
    this.listeners.get('player-leave')!.add(onPlayerLeave);

    return () => {
      this.listeners.get('player-join')?.delete(onPlayerJoin);
      this.listeners.get('player-leave')?.delete(onPlayerLeave);
    };
  }

  // Subscribe to game actions
  subscribeToGameActions(callback: (action: Action) => void): () => void {
    if (!this.listeners.has('game-action')) {
      this.listeners.set('game-action', new Set());
    }
    this.listeners.get('game-action')!.add(callback);

    return () => {
      this.listeners.get('game-action')?.delete(callback);
    };
  }

  // Notify state change
  private notifyStateChange(state: AppState): void {
    this.listeners.get('state-change')?.forEach(callback => {
      callback(state);
    });
  }

  // Notify player join
  private notifyPlayerJoin(player: Player): void {
    this.listeners.get('player-join')?.forEach(callback => {
      callback(player);
    });
  }

  // Notify player leave
  private notifyPlayerLeave(playerId: string): void {
    this.listeners.get('player-leave')?.forEach(callback => {
      callback(playerId);
    });
  }

  // Notify game action
  private notifyGameAction(action: Action): void {
    this.listeners.get('game-action')?.forEach(callback => {
      callback(action);
    });
  }

  // Handle reconnection
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, 1000 * this.reconnectAttempts); // Exponential backoff
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  // Cleanup
  destroy(): void {
    if (this.socket) {
      this.socket.emit('leave-room', {
        roomCode: this.roomCode,
        userId: this.userId,
      });
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get current server URL
  getCurrentServer(): string {
    return SERVER_URLS[this.currentServerIndex] || 'Unknown';
  }

  getRoomState(): AppState | null {
    return this.currentState;
  }
}

// Export singleton instances
export const remoteGameServices = new Map<string, RemoteGameService>();

// Helper function to get or create remote game service
export const getRemoteGameService = (roomCode: string, userId: string, user: Player): RemoteGameService => {
  const key = `${roomCode}-${userId}`;
  if (!remoteGameServices.has(key)) {
    remoteGameServices.set(key, new RemoteGameService(roomCode, userId, user));
  }
  return remoteGameServices.get(key)!;
}; 