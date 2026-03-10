import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Info } from 'lucide-react';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';

interface BatchStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winnerIds: string[];
  /** Current status slugs of selected winners – used to filter allowed transitions */
  currentStatuses?: string[];
  onDone: () => void;
}

export function BatchStatusModal({ open, onOpenChange, winnerIds, currentStatuses = [], onDone }: BatchStatusModalProps) {
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { activeOrdered, getAllowedTransitions } = useWinnerStatusMap();

  // Compute allowed target statuses based on current statuses of selected winners
  const availableStatuses = useMemo(() => {
    const uniqueStatuses = [...new Set(currentStatuses)];

    if (uniqueStatuses.length === 0) {
      // No info about current statuses – show all
      return activeOrdered;
    }

    if (uniqueStatuses.length === 1) {
      // All selected winners share the same status – filter by allowed transitions
      return getAllowedTransitions(uniqueStatuses[0]);
    }

    // Mixed statuses – compute intersection of allowed transitions
    const transitionSets = uniqueStatuses.map(s =>
      new Set(getAllowedTransitions(s).map(t => t.slug))
    );
    const intersection = transitionSets.reduce((acc, set) => {
      return new Set([...acc].filter(slug => set.has(slug)));
    });

    // Also exclude any status that is currently held by any selected winner
    const currentSet = new Set(uniqueStatuses);
    return activeOrdered.filter(s => intersection.has(s.slug) && !currentSet.has(s.slug));
  }, [currentStatuses, activeOrdered, getAllowedTransitions]);

  const isMixed = new Set(currentStatuses).size > 1;

  const handleSave = async () => {
    if (!status || winnerIds.length === 0) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('winners')
        .update({ status: status as any, updated_at: new Date().toISOString() })
        .in('id', winnerIds);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['winners'] });
      toast.success(`Status atualizado para ${winnerIds.length} ganhador(es).`);
      onDone();
      onOpenChange(false);
      setStatus('');
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || '';
      if (msg.includes('Transição de status não permitida')) {
        toast.error('Transição de status não permitida. Verifique as transições configuradas em Configurações → Status.');
      } else {
        toast.error('Erro ao atualizar status.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) setStatus(''); onOpenChange(v); }}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Alterar Status em Lote</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm">
                Alterar status de <strong>{winnerIds.length}</strong> ganhador(es) selecionados.
              </p>
              {isMixed && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  Seleção com status diferentes — exibindo apenas transições em comum.
                </p>
              )}
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o novo status..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                  {availableStatuses.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhuma transição permitida para este status.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <Button onClick={handleSave} disabled={saving || !status}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirmar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
