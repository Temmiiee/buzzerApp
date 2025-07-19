'use client';

import React, { createContext, useContext, useReducer, useEffect, type Dispatch, type ReactNode } from 'react';
import { type AppState, type Action, type Player } from '@/types';
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

const reducer = (state: AppState, action: Action): AppState => {
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
    case 'PRESS_BUZZER':
        if (!state.buzzerActive || state.buzzerWinner) return state;
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
            return { ...state, isLockdown: false, lockdownTimer: 0, buzzerActive: true };
        }
        const newTime = state.lockdownTimer - 1;
        return {
            ...state,
            lockdownTimer: newTime,
            isLockdown: newTime > 0,
            buzzerActive: newTime <= 0,
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
  const userId = React.useMemo(() => `user-${Math.random().toString(36).substring(2, 9)}`, []);

  const dispatchWithBroadcast = (action: Action) => {
    const newState = reducer(state, action);
    try {
      localStorage.setItem(`buzzer-room-${roomCode}`, JSON.stringify(newState));
    } catch (error) {
      console.error("Could not write to localStorage", error);
    }
    window.dispatchEvent(new StorageEvent('storage', { key: `buzzer-room-${roomCode}` }));
    // Also update local state immediately
    dispatch({ type: 'SET_STATE', payload: newState});
  };

  useEffect(() => {
    if (!roomCode || !userNickname) return;
    
    const user = { id: userId, name: userNickname };
    
    const roomStateRaw = localStorage.getItem(`buzzer-room-${roomCode}`);
    let roomState: AppState;

    if (roomStateRaw) {
      roomState = JSON.parse(roomStateRaw);
      // Check if this player is already in the list, if not, add them
      if (!roomState.players.some(p => p.id === userId)) {
        roomState.players.push(user);
      }
    } else {
      // First player creates the room
      roomState = {
        ...initialState,
        roomCode,
        user: user,
        players: [user],
        isAdmin: true,
      };
    }
    
    // Set user and isAdmin status for the current user
    const amIAdmin = roomState.players[0]?.id === userId;
    const finalState = { ...roomState, user, isAdmin: amIAdmin };

    dispatch({ type: 'SET_STATE', payload: finalState });
    localStorage.setItem(`buzzer-room-${roomCode}`, JSON.stringify(finalState));
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === `buzzer-room-${roomCode}` && event.newValue) {
        const newState = JSON.parse(event.newValue);
        // Important: we keep the current user's info, as it's session-specific
        const amIAdmin = newState.players[0]?.id === userId;
        dispatch({ type: 'SET_STATE', payload: {...newState, user, isAdmin: amIAdmin } });
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      // On unmount, remove player from the list
      const currentStateRaw = localStorage.getItem(`buzzer-room-${roomCode}`);
      if (currentStateRaw) {
        const currentState = JSON.parse(currentStateRaw);
        currentState.players = currentState.players.filter((p: Player) => p.id !== userId);
        localStorage.setItem(`buzzer-room-${roomCode}`, JSON.stringify(currentState));
        window.dispatchEvent(new StorageEvent('storage', { key: `buzzer-room-${roomCode}` }));
      }
    };
  }, [roomCode, userNickname, userId]);


  useEffect(() => {
    if (state.isLockdown && state.lockdownTimer > 0) {
      const timer = setInterval(() => {
        dispatchWithBroadcast({ type: 'TICK_LOCKDOWN' });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state.isLockdown, state.lockdownTimer, state.config.lockdownPeriod]);


  return <GameContext.Provider value={{ state, dispatch: dispatchWithBroadcast }}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
