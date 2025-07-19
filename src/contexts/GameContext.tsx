'use client';

import React, { createContext, useContext, useReducer, useEffect, type Dispatch, type ReactNode } from 'react';
import { type AppState, type Action, type Player } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase';
import { ref, onValue, set, onDisconnect, serverTimestamp, get } from "firebase/database";

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
        ...initialState,
        roomCode,
        user,
        players,
        isAdmin,
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
    case 'UPDATE_PLAYERS': {
        return { ...state, players: action.payload };
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
    const roomRef = ref(database, `rooms/${roomCode}`);
    set(roomRef, newState);
  };
  
  useEffect(() => {
    if (!roomCode || !userNickname) return;
    
    const roomRef = ref(database, `rooms/${roomCode}`);
    const playerRef = ref(database, `rooms/${roomCode}/players/${userId}`);
    const user = { id: userId, name: userNickname };

    const unsubscribe = onValue(roomRef, async (snapshot) => {
        const roomData = snapshot.val() as AppState;

        if (roomData) {
            dispatch({ type: 'SET_STATE', payload: roomData });
        } else {
            const initialRoomState: AppState = {
                ...initialState,
                roomCode,
                user: user,
                players: [user],
                isAdmin: true,
            };
            await set(roomRef, initialRoomState);
            dispatch({ type: 'SET_STATE', payload: initialRoomState });
        }

        const playersRef = ref(database, `rooms/${roomCode}/players`);
        const snapshotPlayers = await get(playersRef);
        let playersList: Player[] = snapshotPlayers.exists() ? Object.values(snapshotPlayers.val()) : [];
        
        if (!playersList.some(p => p.id === userId)) {
          playersList.push(user);
        }
        
        await set(ref(database, `rooms/${roomCode}/players`), playersList);
        
        const amIAdmin = playersList[0]?.id === userId;
        dispatch({ type: 'SET_STATE', payload: { ...roomData, user, isAdmin: amIAdmin, players: playersList }});

        onDisconnect(playerRef).remove();
        onDisconnect(ref(database, `rooms/${roomCode}/players`)).set(playersList.filter(p => p.id !== userId));
    });

    return () => {
        unsubscribe();
        const playerRef = ref(database, `rooms/${roomCode}/players/${userId}`);
        set(playerRef, null);
    };

  }, [roomCode, userNickname, userId]);


  useEffect(() => {
    if (state.isLockdown && state.lockdownTimer > 0) {
      const timer = setInterval(() => {
        dispatchWithBroadcast({ type: 'TICK_LOCKDOWN' });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state.isLockdown, state.lockdownTimer]);


  return <GameContext.Provider value={{ state, dispatch: dispatchWithBroadcast }}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
