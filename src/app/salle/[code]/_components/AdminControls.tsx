'use client';

import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, XCircle } from 'lucide-react';

export default function AdminControls() {
  const { state, dispatch } = useGame();

  if (!state.isAdmin) {
    return null;
  }

  return (
    <div className="flex justify-center gap-4 p-2 rounded-lg bg-muted">
        <Button onClick={() => dispatch({ type: 'RESET_ROUND' })} variant="secondary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Réinitialiser / Prochaine Question
        </Button>
        <Button onClick={() => dispatch({ type: 'END_GAME' })} variant="destructive">
            <XCircle className="mr-2 h-4 w-4" />
            Terminez le round
        </Button>
    </div>
  );
}
