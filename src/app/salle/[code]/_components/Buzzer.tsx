'use client';

import { useGame } from '@/contexts/GameContext';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Buzzer() {
  const { state, dispatch } = useGame();
  
  const canBuzz = () => {
    if (!state.buzzerActive) return false;
    if (state.isLockdown) {
      return state.user.id === state.config.designatedPlayerId;
    }
    return true;
  }
  
  const isDisabled = !canBuzz();

  const handleBuzz = () => {
    if (!isDisabled) {
      dispatch({ type: 'PRESS_BUZZER', payload: { player: state.user } });
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      <motion.button
        onClick={handleBuzz}
        disabled={isDisabled}
        className={`relative flex items-center justify-center rounded-full w-48 h-48 md:w-64 md:h-64 transition-all duration-200 ease-in-out
          ${isDisabled
            ? 'bg-gray-400 cursor-not-allowed shadow-inner'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xl hover:shadow-primary/50'
          }`}
        whileTap={!isDisabled ? { scale: 0.9 } : {}}
        aria-label="Buzzer"
      >
        <Zap className={`w-24 h-24 md:w-32 md:h-32 transition-transform duration-200 ${!isDisabled ? 'group-hover:scale-110' : ''}`} />
        
        {state.isLockdown && <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-dashed border-white/50 animate-spin-slow" />}
      </motion.button>
    </div>
  );
}
