'use client';

import { useGame } from '@/contexts/GameContext';
import PlayerList from './PlayerList';
import Buzzer from './Buzzer';
import AdminControls from './AdminControls';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Player } from '@/types';

export default function GameScreen() {
  const { state } = useGame();

  const getGameStatusText = () => {
    if (state.buzzerWinner) {
      return `${state.buzzerWinner.name} a buzzé !`;
    }
    if (state.isLockdown) {
      if (state.config.mode === 'single_buzz') {
        const playersArray = state.players && typeof state.players === 'object' 
          ? Object.values(state.players as Record<string, Player>) 
          : Array.isArray(state.players) ? state.players : [];
        const designatedPlayer = playersArray.find(p => p.id === state.config.designatedPlayerId);
        return `${designatedPlayer?.name || 'Le joueur désigné'} peut buzzer maintenant ! (${state.lockdownTimer}s pour les autres)`;
      } else if (state.config.mode === 'ffa') {
        return `Le buzzer sera activé dans ${state.lockdownTimer}s...`;
      }
    }
    if (state.buzzerActive) {
        if (state.config.mode === 'single_buzz') {
            const playersArray = state.players && typeof state.players === 'object' 
              ? Object.values(state.players as Record<string, Player>) 
              : Array.isArray(state.players) ? state.players : [];
            const designatedPlayer = playersArray.find(p => p.id === state.config.designatedPlayerId);
            return `${designatedPlayer?.name || 'Le joueur désigné'} peut buzzer à tout moment !`;
        }
        return 'BUZZEZ !';
    }
    return "En attente...";
  };

  return (
    <div className="container mx-auto p-4 flex flex-col h-screen pt-20">
      <header className="flex-shrink-0 mb-4">
        {state.isAdmin && <AdminControls />}
      </header>
      
      <main className="flex-grow flex flex-col md:flex-row gap-4 items-center justify-center">
        <div className="w-full md:w-1/3 order-2 md:order-1">
          <Card>
            <CardContent className="p-4">
              <h2 className="text-xl font-bold mb-2">Joueurs</h2>
              <PlayerList />
            </CardContent>
          </Card>
        </div>

        <div className="w-full md:w-2/3 order-1 md:order-2 flex flex-col items-center justify-center gap-8">
            <div className="text-center h-16">
                 <AnimatePresence mode="wait">
                    <motion.h1
                        key={getGameStatusText()}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3 }}
                        className="text-4xl font-extrabold tracking-tight"
                    >
                        {getGameStatusText()}
                    </motion.h1>
                </AnimatePresence>
            </div>
            <Buzzer />
        </div>
      </main>
    </div>
  );
}
