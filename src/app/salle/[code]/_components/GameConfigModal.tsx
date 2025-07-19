'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type GameConfig } from '@/types';
import { useEffect } from 'react';

const configSchema = z.object({
  mode: z.enum(['ffa', 'single_buzz']),
  designatedPlayerId: z.string().nullable(),
  lockdownPeriod: z.coerce.number().min(1, "Doit être d'au moins 1 seconde").max(60, "Ne peut pas dépasser 60 secondes"),
}).refine(data => data.mode !== 'single_buzz' || (data.mode === 'single_buzz' && data.designatedPlayerId), {
    message: "Veuillez désigner un joueur pour le mode Buzz Unique.",
    path: ["designatedPlayerId"],
});


type ConfigFormValues = z.infer<typeof configSchema>;

interface GameConfigModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GameConfigModal({ isOpen, onOpenChange }: GameConfigModalProps) {
  const { state, dispatch } = useGame();
  
  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: state.config,
  });

  useEffect(() => {
    form.reset(state.config);
  }, [state.config, form]);


  const selectedMode = form.watch('mode');

  const onSubmit = (data: ConfigFormValues) => {
    const finalConfig: GameConfig = {
      ...data,
      designatedPlayerId: data.mode === 'single_buzz' ? data.designatedPlayerId : null,
    };
    dispatch({ type: 'START_GAME', payload: { config: finalConfig } });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Configuration de la partie</DialogTitle>
            <DialogDescription>
              Choisissez les règles du jeu avant de commencer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Mode de jeu</Label>
              <RadioGroup
                onValueChange={(value) => form.setValue('mode', value as 'ffa' | 'single_buzz')}
                defaultValue={form.getValues('mode')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ffa" id="ffa" />
                  <Label htmlFor="ffa">FFA (Chacun pour soi)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single_buzz" id="single_buzz" />
                  <Label htmlFor="single_buzz">Buzz Unique</Label>
                </div>
              </RadioGroup>
            </div>

            {selectedMode === 'single_buzz' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="designated-player">Joueur désigné</Label>
                  <Select
                    onValueChange={(value) => form.setValue('designatedPlayerId', value)}
                    defaultValue={form.getValues('designatedPlayerId') || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un joueur" />
                    </SelectTrigger>
                    <SelectContent>
                      {state.players.map(player => (
                        <SelectItem key={player.id} value={player.id}>{player.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                   {form.formState.errors.designatedPlayerId && <p className="text-sm text-destructive">{form.formState.errors.designatedPlayerId.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lockdown-period">Période de verrouillage (secondes)</Label>
                  <Input 
                    id="lockdown-period" 
                    type="number" 
                    {...form.register('lockdownPeriod')} 
                  />
                  {form.formState.errors.lockdownPeriod && <p className="text-sm text-destructive">{form.formState.errors.lockdownPeriod.message}</p>}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="submit">Lancer la partie</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
