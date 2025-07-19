'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap } from 'lucide-react';

const createSchema = z.object({
  nickname: z.string().min(2, { message: 'Le pseudonyme doit contenir au moins 2 caractères.' }).max(20, { message: 'Le pseudonyme ne peut pas dépasser 20 caractères.' }),
});

const joinSchema = z.object({
  nickname: z.string().min(2, { message: 'Le pseudonyme doit contenir au moins 2 caractères.' }).max(20, { message: 'Le pseudonyme ne peut pas dépasser 20 caractères.' }),
  roomCode: z.string().length(5, { message: 'Le code de la salle doit contenir 5 caractères.' }).regex(/^[a-zA-Z0-9]+$/, { message: 'Code invalide.' }),
});

type CreateFormValues = z.infer<typeof createSchema>;
type JoinFormValues = z.infer<typeof joinSchema>;

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
  });

  const joinForm = useForm<JoinFormValues>({
    resolver: zodResolver(joinSchema),
  });

  const handleCreateRoom: SubmitHandler<CreateFormValues> = (data) => {
    setLoading(true);
    const roomCode = generateRoomCode();
    router.push(`/salle/${roomCode}?nickname=${encodeURIComponent(data.nickname)}`);
  };

  const handleJoinRoom: SubmitHandler<JoinFormValues> = (data) => {
    setLoading(true);
    router.push(`/salle/${data.roomCode.toUpperCase()}?nickname=${encodeURIComponent(data.nickname)}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="bg-primary/20 p-4 rounded-full mb-4">
          <Zap className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-5xl font-bold text-foreground font-headline">Buzzer Éclair</h1>
        <p className="text-muted-foreground mt-2">Le jeu de buzzer ultime pour des soirées endiablées.</p>
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>Commencer une partie</CardTitle>
          <CardDescription>Créez une nouvelle salle ou rejoignez une partie existante.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Créer une salle</TabsTrigger>
              <TabsTrigger value="join">Rejoindre</TabsTrigger>
            </TabsList>
            <TabsContent value="create">
              <form onSubmit={createForm.handleSubmit(handleCreateRoom)} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="create-nickname">Votre pseudonyme</Label>
                  <Input id="create-nickname" placeholder="Joueur_1" {...createForm.register('nickname')} />
                  {createForm.formState.errors.nickname && <p className="text-sm text-destructive">{createForm.formState.errors.nickname.message}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Création...' : 'Créer et entrer'}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="join">
              <form onSubmit={joinForm.handleSubmit(handleJoinRoom)} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="join-nickname">Votre pseudonyme</Label>
                  <Input id="join-nickname" placeholder="Joueur_2" {...joinForm.register('nickname')} />
                   {joinForm.formState.errors.nickname && <p className="text-sm text-destructive">{joinForm.formState.errors.nickname.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="room-code">Code de la salle</Label>
                  <Input id="room-code" placeholder="XYZ12" {...joinForm.register('roomCode')} />
                   {joinForm.formState.errors.roomCode && <p className="text-sm text-destructive">{joinForm.formState.errors.roomCode.message}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Connexion...' : 'Rejoindre la salle'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
