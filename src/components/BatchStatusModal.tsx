import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';

interface BatchStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winnerIds: string[];
  onDone: () => void;
}

export function BatchStatusModal({ open, onOpenChange, winnerIds, onDone }: BatchStatusModalProps) {
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { activeOrdered, getLabel } = useWinnerStatusMap();

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
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status.');
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
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o novo status..." />
                </SelectTrigger>
                <SelectContent>
                  {activeOrdered.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
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
