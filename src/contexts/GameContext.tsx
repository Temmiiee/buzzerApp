'use client';

import React, { createContext, useContext, useReducer, useEffect, type Dispatch, type ReactNode } from 'react';
import { type AppState, type Action, type Player, type GameConfig } from '@/types';
import { useToast } from '@/hooks/use-toast';

const initialState: AppState = {
  roomCode: '',
  user: { id: '', name: '' },
  isAdmin: false,
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
};

const FAKE_PLAYERS: Player[] = [
    { id: 'fp1', name: 'Jeanne' },
    { id: 'fp2', name: 'Thomas' },
    { id: 'fp3', name: 'Léa' },
];

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_INITIAL_STATE': {
      const { user } = action.payload;
      const players = [user];
      const isAdmin = players.length === 1;
      return {
        ...state,
        ...action.payload,
        players,
        isAdmin,
      };
    }
    case 'ADD_PLAYER': {
      if (state.players.find(p => p.id === action.payload.id)) return state;
      return { ...state, players: [...state.players, action.payload] };
    }
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
    case 'PRESS_BUZZER':
        if (!state.buzzerActive) return state;
        return {
            ...state,
            buzzerActive: false,
            buzzerWinner: action.payload.player,
            isLockdown: false,
            lockdownTimer: 0,
        };
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
        }
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

const GameContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | undefined>(undefined);

export const GameProvider = ({ children, roomCode, userNickname }: { children: ReactNode; roomCode: string; userNickname: string }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { toast } = useToast();

  useEffect(() => {
    const user: Player = { id: `user-${Date.now()}`, name: userNickname };
    dispatch({ type: 'SET_INITIAL_STATE', payload: { roomCode, user } });
  }, [roomCode, userNickname]);

  useEffect(() => {
    if (state.phase === 'lobby' && state.isAdmin) {
        let playerIndex = 0;
        const interval = setInterval(() => {
            if (playerIndex < FAKE_PLAYERS.length) {
                const newPlayer = FAKE_PLAYERS[playerIndex];
                dispatch({ type: 'ADD_PLAYER', payload: newPlayer });
                toast({ title: `${newPlayer.name} a rejoint la salle !` });
                playerIndex++;
            } else {
                clearInterval(interval);
            }
        }, 2000); // Add a fake player every 2 seconds
        return () => clearInterval(interval);
    }
  }, [state.phase, state.isAdmin, toast]);

  useEffect(() => {
    if (state.isLockdown && state.lockdownTimer > 0) {
      const timer = setInterval(() => {
        dispatch({ type: 'TICK_LOCKDOWN' });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state.isLockdown, state.lockdownTimer]);

  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
