import { type AppState, type Player, type Action } from '@/types';

// Event types for localStorage synchronization
export const GAME_EVENTS = {
  STATE_CHANGE: 'buzzer-game-state-change',
  PLAYER_JOIN: 'buzzer-player-join',
  PLAYER_LEAVE: 'buzzer-player-leave',
  GAME_ACTION: 'buzzer-game-action',
} as const;

// Game service for localStorage-based multiplayer
export class GameService {
  private roomCode: string;
  private userId: string;
  private listeners: Map<string, Set<Function>> = new Map();
  private storageKey: string;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(roomCode: string, userId: string) {
    this.roomCode = roomCode;
    this.userId = userId;
    this.storageKey = `buzzer-room-${roomCode}`;
    this.setupStorageListener();
    this.setupEventListeners();
    this.startSyncInterval();
  }

  // Initialize room state
  initializeRoom(user: Player): AppState {
    const existingState = this.getRoomState();
    
    if (existingState) {
      // Room exists, add player if not already present
      const playersArray = Array.isArray(existingState.players) ? existingState.players : Object.values(existingState.players);
      const playerExists = playersArray.some((p: Player) => p.id === user.id);
      if (!playerExists) {
        if (Array.isArray(existingState.players)) {
          existingState.players.push(user);
        } else {
          existingState.players[user.id] = user;
        }
        this.updateRoomState(existingState);
      }
      return existingState;
    } else {
      // Create new room
      const newState: AppState = {
        roomCode: this.roomCode,
        user,
        isAdmin: true,
        players: [user],
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
      };
      this.updateRoomState(newState);
      return newState;
    }
  }

  // Get current room state
  getRoomState(): AppState | null {
    try {
      const stateStr = localStorage.getItem(this.storageKey);
      return stateStr ? JSON.parse(stateStr) : null;
    } catch (error) {
      console.error('Error reading room state:', error);
      return null;
    }
  }

  // Update room state and notify other tabs
  updateRoomState(state: AppState): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
      this.notifyStateChange(state);
    } catch (error) {
      console.error('Error updating room state:', error);
    }
  }

  // Dispatch game action
  dispatchAction(action: Action): void {
    const currentState = this.getRoomState();
    if (!currentState) return;

    const newState = this.reducer(currentState, action);
    this.updateRoomState(newState);
  }

  // Game state reducer
  private reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
      case 'SET_STATE':
        return { ...state, ...action.payload };
      case 'START_GAME': {
        const isLockdown = action.payload.config.mode === 'single_buzz' && !!action.payload.config.designatedPlayerId;
        return {
          ...state,
          config: action.payload.config,
          phase: 'game',
          buzzerActive: true,
          buzzerWinner: null,
          isLockdown: isLockdown,
          lockdownTimer: isLockdown ? action.payload.config.lockdownPeriod : 0,
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
        const isLockdown = state.config.mode === 'single_buzz' && !!state.config.designatedPlayerId;
        return {
          ...state,
          buzzerActive: true,
          buzzerWinner: null,
          phase: 'game',
          isLockdown,
          lockdownTimer: isLockdown ? state.config.lockdownPeriod : 0,
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
  }

  // Add player to room
  addPlayer(player: Player): void {
    const state = this.getRoomState();
    if (!state) return;

    const playersArray = Array.isArray(state.players) ? state.players : Object.values(state.players);
    const playerExists = playersArray.some((p: Player) => p.id === player.id);
    
    if (!playerExists) {
      if (Array.isArray(state.players)) {
        state.players.push(player);
      } else {
        state.players[player.id] = player;
      }
      this.updateRoomState(state);
      this.notifyPlayerJoin(player);
    }
  }

  // Remove player from room
  removePlayer(playerId: string): void {
    const state = this.getRoomState();
    if (!state) return;

    if (Array.isArray(state.players)) {
      state.players = state.players.filter((p: Player) => p.id !== playerId);
    } else {
      delete state.players[playerId];
    }
    
    this.updateRoomState(state);
    this.notifyPlayerLeave(playerId);
  }

  // Subscribe to state changes
  subscribe(callback: (state: AppState) => void): () => void {
    if (!this.listeners.has(GAME_EVENTS.STATE_CHANGE)) {
      this.listeners.set(GAME_EVENTS.STATE_CHANGE, new Set());
    }
    this.listeners.get(GAME_EVENTS.STATE_CHANGE)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(GAME_EVENTS.STATE_CHANGE)?.delete(callback);
    };
  }

  // Subscribe to player events
  subscribeToPlayerEvents(
    onPlayerJoin: (player: Player) => void,
    onPlayerLeave: (playerId: string) => void
  ): () => void {
    if (!this.listeners.has(GAME_EVENTS.PLAYER_JOIN)) {
      this.listeners.set(GAME_EVENTS.PLAYER_JOIN, new Set());
    }
    if (!this.listeners.has(GAME_EVENTS.PLAYER_LEAVE)) {
      this.listeners.set(GAME_EVENTS.PLAYER_LEAVE, new Set());
    }

    this.listeners.get(GAME_EVENTS.PLAYER_JOIN)!.add(onPlayerJoin);
    this.listeners.get(GAME_EVENTS.PLAYER_LEAVE)!.add(onPlayerLeave);

    return () => {
      this.listeners.get(GAME_EVENTS.PLAYER_JOIN)?.delete(onPlayerJoin);
      this.listeners.get(GAME_EVENTS.PLAYER_LEAVE)?.delete(onPlayerLeave);
    };
  }

  // Notify state change to other tabs
  private notifyStateChange(state: AppState): void {
    const event = new CustomEvent(GAME_EVENTS.STATE_CHANGE, { 
      detail: { state, roomCode: this.roomCode }, 
      bubbles: true 
    });
    window.dispatchEvent(event);
  }

  // Notify player join
  private notifyPlayerJoin(player: Player): void {
    const event = new CustomEvent(GAME_EVENTS.PLAYER_JOIN, { 
      detail: { player, roomCode: this.roomCode }, 
      bubbles: true 
    });
    window.dispatchEvent(event);
  }

  // Notify player leave
  private notifyPlayerLeave(playerId: string): void {
    const event = new CustomEvent(GAME_EVENTS.PLAYER_LEAVE, { 
      detail: { playerId, roomCode: this.roomCode }, 
      bubbles: true 
    });
    window.dispatchEvent(event);
  }

  // Setup storage event listener for cross-tab communication
  private setupStorageListener(): void {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === this.storageKey && event.newValue) {
        try {
          const newState = JSON.parse(event.newValue);
          this.listeners.get(GAME_EVENTS.STATE_CHANGE)?.forEach(callback => {
            callback(newState);
          });
        } catch (error) {
          console.error('Error parsing storage change:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
  }

  // Setup custom event listeners
  private setupEventListeners(): void {
    const handleGameEvent = (event: CustomEvent) => {
      if (event.detail.roomCode !== this.roomCode) return;

      switch (event.type) {
        case GAME_EVENTS.STATE_CHANGE:
          this.listeners.get(GAME_EVENTS.STATE_CHANGE)?.forEach(callback => {
            callback(event.detail.state);
          });
          break;
        case GAME_EVENTS.PLAYER_JOIN:
          this.listeners.get(GAME_EVENTS.PLAYER_JOIN)?.forEach(callback => {
            callback(event.detail.player);
          });
          break;
        case GAME_EVENTS.PLAYER_LEAVE:
          this.listeners.get(GAME_EVENTS.PLAYER_LEAVE)?.forEach(callback => {
            callback(event.detail.playerId);
          });
          break;
      }
    };

    window.addEventListener(GAME_EVENTS.STATE_CHANGE, handleGameEvent as EventListener);
    window.addEventListener(GAME_EVENTS.PLAYER_JOIN, handleGameEvent as EventListener);
    window.addEventListener(GAME_EVENTS.PLAYER_LEAVE, handleGameEvent as EventListener);
  }

  // Start periodic sync to handle edge cases
  private startSyncInterval(): void {
    this.syncInterval = setInterval(() => {
      // No automatic cleanup - players stay connected indefinitely
      // This interval is kept for potential future features
    }, 60000); // Check every minute
  }

  // Cleanup
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.removePlayer(this.userId);
    this.listeners.clear();
  }
}

// Export singleton instance
export const gameService = new Map<string, GameService>();

// Helper function to get or create game service
export const getGameService = (roomCode: string, userId: string): GameService => {
  const key = `${roomCode}-${userId}`;
  if (!gameService.has(key)) {
    gameService.set(key, new GameService(roomCode, userId));
  }
  return gameService.get(key)!;
}; 