export interface Player {
  id: string;
  name: string;
}

export type GameMode = 'ffa' | 'single_buzz';

export interface GameConfig {
  mode: GameMode;
  lockdownPeriod: number; // in seconds
  designatedPlayerId: string | null;
}

export type GamePhase = 'lobby' | 'game' | 'results';

export interface AppState {
  roomCode: string;
  user: Player;
  isAdmin: boolean;
  players: Player[];
  phase: GamePhase;
  config: GameConfig;
  buzzerActive: boolean;
  buzzerWinner: Player | null;
  lockdownTimer: number; // countdown for single_buzz mode
  isLockdown: boolean;
}

export type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'SET_INITIAL_STATE'; payload: { roomCode: string; user: Player, players: Player[], isAdmin: boolean } }
  | { type: 'UPDATE_PLAYERS'; payload: Player[] }
  | { type: 'START_GAME'; payload: { config: GameConfig } }
  | { type: 'SET_CONFIG'; payload: GameConfig }
  | { type: 'RESET_ROUND' }
  | { type: 'END_GAME' }
  | { type: 'PRESS_BUZZER'; payload: { player: Player } }
  | { type: 'TICK_LOCKDOWN' };
