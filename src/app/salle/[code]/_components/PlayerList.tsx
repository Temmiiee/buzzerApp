'use client';

import { useGame } from '@/contexts/GameContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Crown, ShieldCheck, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function PlayerList() {
  const { state } = useGame();

  const sortedPlayers = [...state.players].sort((a, b) => {
    // Keep original admin first, then sort by name
    if (state.players[0] && a.id === state.players[0].id) return -1;
    if (state.players[0] && b.id === state.players[0].id) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <TooltipProvider>
      <ul className="space-y-3">
        {sortedPlayers.map((player) => {
          const isWinner = state.buzzerWinner?.id === player.id;
          const isYou = state.user.id === player.id;
          const isAdmin = state.players[0]?.id === player.id;
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
