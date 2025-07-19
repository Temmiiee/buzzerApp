'use client';

import React, { createContext, useContext, useReducer, useEffect, type Dispatch, type ReactNode } from 'react';
import { type AppState, type Action, type Player } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { database, isFirebaseConfigured } from '@/lib/firebase';
import { ref, onValue, set, onDisconnect, serverTimestamp, get, remove } from "firebase/database";

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
    if (!isFirebaseConfigured) {
        console.error("Firebase is not configured. Cannot broadcast action.");
        // We can also dispatch locally to see UI changes without network
        const localState = reducer(state, action);
        dispatch({ type: 'SET_STATE', payload: localState});
        return;
    }
    const newState = reducer(state, action);
    const roomRef = ref(database, `rooms/${roomCode}`);
    set(roomRef, newState);
  };
  
  useEffect(() => {
    if (!isFirebaseConfigured) {
      console.warn("Firebase is not configured. The app will run in offline mode.");
      const user = { id: userId, name: userNickname };
      const localState = {
        ...initialState,
        roomCode,
        user,
        players: [user],
        isAdmin: true,
      };
      dispatch({ type: 'SET_STATE', payload: localState });
      return;
    }
    
    if (!roomCode || !userNickname) return;
    
    const roomRef = ref(database, `rooms/${roomCode}`);
    const user = { id: userId, name: userNickname };

    const unsubscribe = onValue(roomRef, async (snapshot) => {
        let roomData = snapshot.val() as AppState | null;

        const playersRef = ref(database, `rooms/${roomCode}/players`);
        const playerRef = ref(database, `rooms/${roomCode}/players/${userId}`);
        
        if (roomData) {
             const playersSnap = await get(playersRef);
             let playersList: Player[] = playersSnap.exists() ? Object.values(playersSnap.val()) : [];
             if (!playersList.some(p => p.id === userId)) {
                playersList.push(user);
                await set(playersRef, playersList);
             }
             const amIAdmin = playersList[0]?.id === userId;
             dispatch({ type: 'SET_STATE', payload: { ...roomData, user, isAdmin: amIAdmin, players: playersList } });
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
        
        onDisconnect(playerRef).remove();
    });

    return () => {
        unsubscribe();
        const playerRef = ref(database, `rooms/${roomCode}/players/${userId}`);
        remove(playerRef);
    };

  }, [roomCode, userNickname, userId]);


  useEffect(() => {
    if (state.isLockdown && state.lockdownTimer > 0 && isFirebaseConfigured) {
      const timer = setInterval(() => {
        dispatchWithBroadcast({ type: 'TICK_LOCKDOWN' });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state.isLockdown, state.lockdownTimer, state, dispatchWithBroadcast]);


  if (!isFirebaseConfigured) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
          <h1 className="text-2xl font-bold text-destructive">Firebase non configuré</h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            Veuillez mettre à jour le fichier <code className="font-mono bg-muted p-1 rounded">src/lib/firebase.ts</code> avec vos propres informations d'identification Firebase pour activer le mode multijoueur.
          </p>
          <div className="mt-4">
            <GameContext.Provider value={{ state, dispatch: dispatchWithBroadcast }}>
              {children}
            </GameContext.Provider>
          </div>
       </div>
    )
  }

  return <GameContext.Provider value={{ state, dispatch: dispatchWithBroadcast }}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
