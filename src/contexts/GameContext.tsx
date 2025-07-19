'use client';

import React, { createContext, useContext, useReducer, useEffect, type Dispatch, type ReactNode } from 'react';
import { type AppState, type Action, type Player } from '@/types';
import { database, isFirebaseConfigured } from '@/lib/firebase';
import { ref, onValue, set, onDisconnect, serverTimestamp, goOffline, goOnline } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

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

const FirebaseWarning = () => (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full p-4 z-50">
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>Configuration Firebase requise !</AlertTitle>
        <AlertDescription>
          Le mode multijoueur est désactivé. Veuillez configurer vos identifiants Firebase dans le fichier{' '}
          <code className="font-mono text-sm font-semibold">src/lib/firebase.ts</code> pour jouer en ligne.
          Le jeu fonctionne actuellement en mode hors ligne.
        </AlertDescription>
      </Alert>
    </div>
);

export const GameProvider = ({ children, roomCode, userNickname }: { children: ReactNode; roomCode: string; userNickname: string }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { toast } = useToast();
  const userId = React.useMemo(() => `user-${Math.random().toString(36).substring(2, 9)}`, []);
  const [firebaseReady, setFirebaseReady] = React.useState(false);


  const dispatchWithSync = (action: Action) => {
    const newState = reducer(state, action);
    if (database) {
      const roomRef = ref(database, `rooms/${roomCode}`);
      set(roomRef, newState);
    } else {
        // Fallback to localStorage if Firebase is not configured
        localStorage.setItem(`buzzer-room-${roomCode}`, JSON.stringify(newState));
        window.dispatchEvent(new StorageEvent('storage', { key: `buzzer-room-${roomCode}` }));
        dispatch({type: 'SET_STATE', payload: newState})
    }
  };

  useEffect(() => {
    if (!roomCode || !userNickname) return;
    
    const user: Player = { id: userId, name: userNickname };

    if (database) {
        setFirebaseReady(true);
        goOnline(database);
        const roomRef = ref(database, `rooms/${roomCode}`);
        const playerRef = ref(database, `rooms/${roomCode}/players/${userId}`);

        const unsubscribe = onValue(roomRef, (snapshot) => {
            const roomData = snapshot.val();
            if (roomData) {
                // Data exists, join the room
                const amIAdmin = roomData.players ? Object.keys(roomData.players)[0] === userId : false;
                dispatch({ type: 'SET_STATE', payload: { ...roomData, user, isAdmin: amIAdmin } });
                set(playerRef, user);
                onDisconnect(playerRef).remove();
            } else {
                // Room doesn't exist, create it
                const newState = {
                    ...initialState,
                    roomCode,
                    user,
                    players: { [userId]: user },
                    isAdmin: true,
                };
                set(roomRef, newState);
                onDisconnect(playerRef).remove();
            }
        });
        
        return () => {
            unsubscribe();
            const playerRef = ref(database, `rooms/${roomCode}/players/${userId}`);
            set(playerRef, null); // remove player on unmount
            goOffline(database);
        };

    } else {
        // Firebase not configured, use localStorage fallback
        console.warn("Firebase is not configured. Falling back to localStorage.");
        const roomStateRaw = localStorage.getItem(`buzzer-room-${roomCode}`);
        let roomState: AppState;

        if (roomStateRaw) {
          roomState = JSON.parse(roomStateRaw);
          if (!roomState.players.some(p => p.id === userId)) {
            roomState.players.push(user);
          }
        } else {
          roomState = {
            ...initialState,
            roomCode,
            user,
            players: [user],
            isAdmin: true,
          };
        }
        
        const amIAdmin = roomState.players[0]?.id === userId;
        const finalState = { ...roomState, user, isAdmin: amIAdmin };

        dispatch({ type: 'SET_STATE', payload: finalState });
        localStorage.setItem(`buzzer-room-${roomCode}`, JSON.stringify(finalState));
        
        const handleStorageChange = (event: StorageEvent) => {
          if (event.key === `buzzer-room-${roomCode}` && event.newValue) {
            const newState = JSON.parse(event.newValue);
            const amIAdmin = newState.players[0]?.id === userId;
            dispatch({ type: 'SET_STATE', payload: {...newState, user, isAdmin: amIAdmin } });
          }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [roomCode, userNickname, userId]);


  useEffect(() => {
    if (state.isLockdown && state.lockdownTimer > 0 && state.isAdmin) {
      const timer = setInterval(() => {
        dispatchWithSync({ type: 'TICK_LOCKDOWN' });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state.isLockdown, state.lockdownTimer, state.config.lockdownPeriod, state.isAdmin]);


  return (
    <GameContext.Provider value={{ state, dispatch: dispatchWithSync }}>
      {!isFirebaseConfigured() && !firebaseReady && <FirebaseWarning />}
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
