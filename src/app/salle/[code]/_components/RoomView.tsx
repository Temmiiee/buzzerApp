'use client';

import { useGame } from '@/contexts/GameContext';
import Lobby from './Lobby';
import GameScreen from './GameScreen';

export default function RoomView() {
  const { state } = useGame();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {state.phase === 'lobby' ? <Lobby /> : <GameScreen />}
    </div>
  );
}
