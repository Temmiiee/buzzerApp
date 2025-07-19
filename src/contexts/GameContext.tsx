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
        return action.payload;
    case 'SET_INITIAL_STATE': {
      const { roomCode, user, players, isAdmin } = action.payload;
      return {
        ...state,
        roomCode,
        user,
        players,
        isAdmin,
        phase: 'lobby',
      };
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

const getStorageKey = (roomCode: string) => `buzzer-eclair-room-${roomCode}`;

export const GameProvider = ({ children, roomCode, userNickname }: { children: ReactNode; roomCode: string; userNickname: string }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { toast } = useToast();

  const broadcastState = (newState: AppState) => {
    try {
      localStorage.setItem(getStorageKey(roomCode), JSON.stringify(newState));
      window.dispatchEvent(new StorageEvent('storage', { key: getStorageKey(roomCode) }));
    } catch (error) {
      console.error("Could not save state to localStorage", error);
    }
  };
  
  const wrappedDispatch = (action: Action) => {
    const newState = reducer(state, action);
    dispatch({type: 'SET_STATE', payload: newState});
    broadcastState(newState);
  };
  
  useEffect(() => {
    const storageKey = getStorageKey(roomCode);
    
    const user: Player = { id: `user-${Date.now()}`, name: userNickname };
    let currentState: AppState;
    
    try {
        const savedStateJSON = localStorage.getItem(storageKey);
        const savedState = savedStateJSON ? JSON.parse(savedStateJSON) : null;
        
        if (savedState) {
            currentState = savedState;
            if (!currentState.players.find(p => p.name === user.name)) {
                currentState.players.push(user);
            }
        } else {
            currentState = {
                ...initialState,
                roomCode,
                user: user,
                players: [user],
                isAdmin: true,
            };
        }

        dispatch({type: 'SET_INITIAL_STATE', payload: { roomCode, user, players: currentState.players, isAdmin: currentState.players[0].id === user.id }});
        broadcastState(currentState);

    } catch (error) {
        console.error("Failed to initialize from localStorage", error);
        toast({ title: 'Erreur de chargement', description: 'Impossible de synchroniser avec la salle.', variant: 'destructive'});
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey) {
          try {
            const newStateJSON = localStorage.getItem(storageKey);
            if (newStateJSON) {
                const newState = JSON.parse(newStateJSON);
                dispatch({ type: 'SET_STATE', payload: newState });
            }
          } catch(e) {
            console.error("Failed to parse state from storage", e)
          }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };

  }, [roomCode, userNickname]);

  useEffect(() => {
    if (state.isLockdown && state.lockdownTimer > 0) {
      const timer = setInterval(() => {
        wrappedDispatch({ type: 'TICK_LOCKDOWN' });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state.isLockdown, state.lockdownTimer]);

  const dispatchWithBroadcast = (action: Action) => {
    const newState = reducer(state, action);
    dispatch({ type: 'SET_STATE', payload: newState });
    broadcastState(newState);
  };

  return <GameContext.Provider value={{ state, dispatch: dispatchWithBroadcast }}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
