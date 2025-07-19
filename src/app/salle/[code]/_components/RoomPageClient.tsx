'use client';

import { useSearchParams } from 'next/navigation';
import { GameProvider } from '@/contexts/GameContext';
import RoomView from './RoomView';

export default function RoomPageClient({ roomCode }: { roomCode: string }) {
  const searchParams = useSearchParams();
  const nickname = searchParams.get('nickname');

  if (!nickname) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Erreur</h1>
          <p className="text-muted-foreground">Pseudonyme manquant. Veuillez retourner à l'accueil.</p>
        </div>
      </div>
    );
  }

  return (
    <GameProvider roomCode={roomCode} userNickname={nickname}>
      <RoomView />
    </GameProvider>
  );
}
