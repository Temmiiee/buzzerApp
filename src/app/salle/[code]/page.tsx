import { Suspense } from 'react';
import RoomPageClient from './_components/RoomPageClient';
import { Skeleton } from '@/components/ui/skeleton';

export default function RoomPage({ params }: { params: { code: string } }) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <RoomPageClient roomCode={params.code} />
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
