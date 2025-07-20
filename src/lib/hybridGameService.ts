import { type AppState, type Player, type Action } from '@/types';
import { getGameService } from './gameService';
import { getRemoteGameService } from './remoteGameService';

export type GameMode = 'local' | 'remote' | 'fallback';

export class HybridGameService {
  private roomCode: string;
  private userId: string;
  private user: Player;
  private currentMode: GameMode = 'local';
  private localService: any;
  private remoteService: any;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnecting = false;

  constructor(roomCode: string, userId: string, user: Player) {
    this.roomCode = roomCode;
    this.userId = userId;
    this.user = user;
  }

  // Initialize the game service
  async initialize(): Promise<AppState> {
    try {
      // Try remote mode first
      await this.connectRemote();
      return this.remoteService.getRoomState();
    } catch (error) {
      console.log('Remote mode failed, falling back to local mode');
      this.currentMode = 'fallback';
      return this.connectLocal();
    }
  }

  // Try to connect to remote server
  private async connectRemote(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.remoteService = getRemoteGameService(this.roomCode, this.userId, this.user);
      await this.remoteService.connect();
      this.currentMode = 'remote';
      
      // Setup remote listeners
      this.setupRemoteListeners();
      
      console.log('Connected to remote server');
    } catch (error) {
      console.error('Failed to connect to remote server:', error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  // Connect to local mode
  private connectLocal(): AppState {
    this.localService = getGameService(this.roomCode, this.userId);
    this.currentMode = 'local';
    
    // Setup local listeners
    this.setupLocalListeners();
    
    console.log('Using local mode');
    return this.localService.initializeRoom(this.user);
  }

  // Setup remote listeners
  private setupRemoteListeners(): void {
    if (!this.remoteService) return;

    this.remoteService.subscribe((state: AppState) => {
      this.notifyStateChange(state);
    });

    this.remoteService.subscribeToPlayerEvents(
      (player: Player) => {
        this.notifyPlayerJoin(player);
      },
      (playerId: string) => {
        this.notifyPlayerLeave(playerId);
      }
    );

    this.remoteService.subscribeToGameActions((action: Action) => {
      this.notifyGameAction(action);
    });
  }

  // Setup local listeners
  private setupLocalListeners(): void {
    if (!this.localService) return;

    this.localService.subscribe((state: AppState) => {
      this.notifyStateChange(state);
    });

    this.localService.subscribeToPlayerEvents(
      (player: Player) => {
        this.notifyPlayerJoin(player);
      },
      (playerId: string) => {
        this.notifyPlayerLeave(playerId);
      }
    );
  }

  // Dispatch game action
  dispatchAction(action: Action): void {
    if (this.currentMode === 'remote' && this.remoteService) {
      this.remoteService.dispatchAction(action);
    } else if (this.currentMode === 'local' && this.localService) {
      this.localService.dispatchAction(action);
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

  // Get current mode
  getCurrentMode(): GameMode {
    return this.currentMode;
  }

  // Get connection status
  isConnected(): boolean {
    if (this.currentMode === 'remote' && this.remoteService) {
      return this.remoteService.isConnected();
    }
    return this.currentMode === 'local';
  }

  // Try to upgrade to remote mode
  async tryUpgradeToRemote(): Promise<boolean> {
    if (this.currentMode === 'remote') return true;
    
    try {
      await this.connectRemote();
      // Cleanup local service
      if (this.localService) {
        this.localService.destroy();
        this.localService = null;
      }
      return true;
    } catch (error) {
      console.log('Failed to upgrade to remote mode');
      return false;
    }
  }

  // Cleanup
  destroy(): void {
    if (this.remoteService) {
      this.remoteService.destroy();
    }
    if (this.localService) {
      this.localService.destroy();
    }
    this.listeners.clear();
  }
}

// Export singleton instances
export const hybridGameServices = new Map<string, HybridGameService>();

// Helper function to get or create hybrid game service
export const getHybridGameService = (roomCode: string, userId: string, user: Player): HybridGameService => {
  const key = `${roomCode}-${userId}`;
  if (!hybridGameServices.has(key)) {
    hybridGameServices.set(key, new HybridGameService(roomCode, userId, user));
  }
  return hybridGameServices.get(key)!;
}; 