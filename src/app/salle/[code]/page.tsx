'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameProvider } from '@/contexts/GameContext';
import RoomView from './_components/RoomView';
import { Skeleton } from '@/components/ui/skeleton';

function RoomPageContent({ roomCode }: { roomCode: string }) {
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

export default function RoomPage({ params }: { params: { code: string } }) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <RoomPageContent roomCode={params.code} />
    </Suspense>
  );
}

function RoomSkeleton() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-4">
      <Skeleton className="h-8 w-48 mb-4" />
      <Skeleton className="h-6 w-64 mb-8" />
      <div className="w-full max-w-4xl space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
