'use client';

import { useGame } from '@/contexts/GameContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Crown, ShieldCheck, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type Player } from '@/types';

export default function PlayerList() {
  const { state } = useGame();

  // Convert players object to array
  const playersArray = state.players && typeof state.players === 'object' 
    ? Object.values(state.players as Record<string, Player>) 
    : Array.isArray(state.players) ? state.players : [];

  const adminId = playersArray.length > 0 ? Object.keys(state.players as Record<string, Player>)[0] : null;

  const sortedPlayers = [...playersArray].sort((a, b) => {
    if (adminId) {
      if (a.id === adminId) return -1;
      if (b.id === adminId) return 1;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <TooltipProvider>
      <ul className="space-y-3">
        {sortedPlayers.map((player) => {
          const isWinner = state.buzzerWinner?.id === player.id;
          const isYou = state.user.id === player.id;
          const isAdmin = adminId === player.id;
          const isDesignated = state.config.mode === 'single_buzz' && state.config.designatedPlayerId === player.id;

          return (
            <li
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 ${isWinner ? 'bg-primary/20 scale-105 shadow-lg' : 'bg-muted/50'} ${isYou ? 'border-2 border-primary' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{player.name} {isYou && '(Vous)'}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                {isWinner && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Zap className="h-5 w-5 text-primary animate-pulse" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>A buzzé en premier !</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                 {isDesignated && !isWinner && (
                  <Tooltip>
                    <TooltipTrigger>
                      <ShieldCheck className="h-5 w-5 text-blue-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Joueur désigné</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {isAdmin && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Crown className="h-5 w-5 text-amber-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Chef de la salle</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}
