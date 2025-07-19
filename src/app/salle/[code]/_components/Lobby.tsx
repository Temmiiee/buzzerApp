'use client';

import { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Crown, Copy } from 'lucide-react';
import PlayerList from './PlayerList';
import GameConfigModal from './GameConfigModal';
import { useToast } from '@/hooks/use-toast';

export default function Lobby() {
  const { state } = useGame();
  const [isConfigOpen, setConfigOpen] = useState(false);
  const { toast } = useToast();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(state.roomCode);
    toast({
      title: 'Copié !',
      description: 'Le code de la salle a été copié dans le presse-papiers.',
    });
  };

  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Salle d'attente</CardTitle>
          <CardDescription>La partie commencera bientôt.</CardDescription>
          <div className="flex items-center justify-center gap-2 pt-4">
            <span className="text-lg font-semibold">Code de la salle :</span>
            <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
              <span className="text-2xl font-bold tracking-widest text-primary">{state.roomCode}</span>
              <Button variant="ghost" size="icon" onClick={handleCopyCode} className="h-8 w-8">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-xl font-semibold">
              <Users />
              <span>Joueurs ({state.players.length})</span>
            </h3>
            <PlayerList />
            <div className="pt-4 text-center">
              {state.isAdmin ? (
                <>
                  <p className="mb-4 text-muted-foreground flex items-center justify-center gap-2">
                    <Crown className="text-amber-400" /> Vous êtes le chef de la salle.
                  </p>
                  <Button size="lg" onClick={() => setConfigOpen(true)}>
                    Configurer & Démarrer
                  </Button>
                </>
              ) : (
                <p className="text-lg text-muted-foreground">En attente du chef de la salle pour lancer la partie...</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {state.isAdmin && <GameConfigModal isOpen={isConfigOpen} onOpenChange={setConfigOpen} />}
    </main>
  );
}
