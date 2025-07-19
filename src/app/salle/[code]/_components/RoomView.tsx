'use client';

import { useGame } from '@/contexts/GameContext';
import Lobby from './Lobby';
import GameScreen from './GameScreen';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RoomView() {
  const { state } = useGame();
  const router = useRouter();

  const handleLeave = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <div className="absolute top-4 right-4">
        <Button variant="outline" onClick={handleLeave}>
          <LogOut className="mr-2 h-4 w-4" />
          Quitter la salle
        </Button>
      </div>
      {state.phase === 'lobby' ? <Lobby /> : <GameScreen />}
    </div>
  );
}
