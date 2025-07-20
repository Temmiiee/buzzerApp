'use client';

import React, { createContext, useContext, useReducer, useEffect, type Dispatch, type ReactNode } from 'react';
import { type AppState, type Action, type Player } from '@/types';
import { getHybridGameService, type GameMode } from '@/lib/hybridGameService';
import { useToast } from '@/hooks/use-toast';
import { Users, Wifi, Globe } from 'lucide-react';

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

const GameContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | undefined>(undefined);

const ConnectionInfo = ({ mode }: { mode: GameMode }) => {
  const getInfo = () => {
    switch (mode) {
      case 'remote':
        return {
          icon: <Globe className="h-4 w-4 text-green-600" />,
          title: 'Mode Multijoueur en Ligne',
          description: 'Connecté au serveur distant. Vos amis peuvent rejoindre depuis n\'importe où !',
          color: 'green'
        };
      case 'local':
        return {
          icon: <Wifi className="h-4 w-4 text-blue-600" />,
          title: 'Mode Multijoueur Local',
          description: 'Partagez le lien avec vos amis sur le même réseau local.',
          color: 'blue'
        };
      case 'fallback':
        return {
          icon: <Users className="h-4 w-4 text-yellow-600" />,
          title: 'Mode Local (Serveur Indisponible)',
          description: 'Le serveur distant est indisponible. Mode local activé.',
          color: 'yellow'
        };
    }
  };

  const info = getInfo();
  const bgColor = `bg-${info.color}-50`;
  const borderColor = `border-${info.color}-200`;
  const textColor = `text-${info.color}-800`;

  return (
    <div className={`fixed top-4 right-4 max-w-xs p-3 ${bgColor} border ${borderColor} rounded-lg shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        {info.icon}
        <h3 className={`font-semibold text-sm ${textColor}`}>{info.title}</h3>
      </div>
      <p className={`text-xs ${textColor.replace('800', '700')}`}>
        {info.description}
      </p>
    </div>
  );
};

export const GameProvider = ({ children, roomCode, userNickname }: { children: ReactNode; roomCode: string; userNickname: string }) => {
  const [state, dispatch] = useReducer((state: AppState, action: Action): AppState => {
    switch (action.type) {
      case 'SET_STATE':
        return { ...state, ...action.payload };
      default:
        return state;
    }
  }, initialState);
  
  const { toast } = useToast();
  const userId = React.useMemo(() => `user-${Math.random().toString(36).substring(2, 9)}`, []);
  const [gameService, setGameService] = React.useState<any>(null);
  const [connectionMode, setConnectionMode] = React.useState<GameMode>('local');

  // Initialize game service
  useEffect(() => {
    if (!roomCode || !userNickname) return;

    const user: Player = { 
      id: userId, 
      name: userNickname,
      lastSeen: Date.now()
    };

    const service = getHybridGameService(roomCode, userId, user);
    setGameService(service);

    // Initialize the service
    service.initialize().then((initialState) => {
      const amIAdmin = initialState.players[0]?.id === userId;
      const finalState = { ...initialState, user, isAdmin: amIAdmin };
      dispatch({ type: 'SET_STATE', payload: finalState });
      setConnectionMode(service.getCurrentMode());
    }).catch((error) => {
      console.error('Failed to initialize game service:', error);
      toast({
        title: "Erreur de connexion",
        description: "Impossible de se connecter au serveur. Mode local activé.",
        variant: "destructive"
      });
    });

    // Subscribe to state changes
    const unsubscribe = service.subscribe((newState: AppState) => {
      const amIAdmin = newState.players[0]?.id === userId;
      dispatch({ type: 'SET_STATE', payload: { ...newState, user, isAdmin: amIAdmin } });
    });

    // Subscribe to player events
    const unsubscribePlayerEvents = service.subscribeToPlayerEvents(
      (player: Player) => {
        toast({
          title: "Nouveau joueur",
          description: `${player.name} a rejoint la partie`,
        });
      },
      (playerId: string) => {
        const player = state.players.find(p => p.id === playerId);
        if (player) {
          toast({
            title: "Joueur parti",
            description: `${player.name} a quitté la partie`,
          });
        }
      }
    );

    // Subscribe to game actions
    const unsubscribeGameActions = service.subscribeToGameActions((action: Action) => {
      // Handle game actions from other players
      if (action.type === 'PRESS_BUZZER') {
        toast({
          title: "Buzzer pressé !",
          description: `${action.payload.player.name} a gagné !`,
        });
      }
    });

    // Update connection mode periodically
    const modeInterval = setInterval(() => {
      setConnectionMode(service.getCurrentMode());
    }, 5000);

    // Try to upgrade to remote mode periodically
    const upgradeInterval = setInterval(() => {
      if (service.getCurrentMode() !== 'remote') {
        service.tryUpgradeToRemote().then((success) => {
          if (success) {
            setConnectionMode('remote');
            toast({
              title: "Connexion améliorée",
              description: "Connecté au serveur distant pour un meilleur multijoueur !",
            });
          }
        });
      }
    }, 30000); // Try every 30 seconds

    return () => {
      unsubscribe();
      unsubscribePlayerEvents();
      unsubscribeGameActions();
      clearInterval(modeInterval);
      clearInterval(upgradeInterval);
      service.destroy();
    };
  }, [roomCode, userNickname, userId, toast]);

  // Handle lockdown timer
  useEffect(() => {
    if (state.isLockdown && state.lockdownTimer > 0 && state.isAdmin && gameService) {
      const timer = setInterval(() => {
        gameService.dispatchAction({ type: 'TICK_LOCKDOWN' });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state.isLockdown, state.lockdownTimer, state.isAdmin, gameService]);

  // Dispatch action through game service
  const dispatchWithSync = (action: Action) => {
    if (gameService) {
      gameService.dispatchAction(action);
    }
  };

  return (
    <GameContext.Provider value={{ state, dispatch: dispatchWithSync }}>
      <ConnectionInfo mode={connectionMode} />
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
