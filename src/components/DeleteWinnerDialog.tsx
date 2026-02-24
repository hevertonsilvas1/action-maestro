import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { insertAuditLog } from '@/hooks/useAuditLogger';
import type { Winner } from '@/types';

const BLOCKED_STATUSES = ['receipt_attached', 'receipt_sent'];

interface DeleteWinnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winner: Winner | null;
  actionName: string;
}

export function DeleteWinnerDialog({ open, onOpenChange, winner, actionName }: DeleteWinnerDialogProps) {
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const isBlocked = winner && BLOCKED_STATUSES.includes(winner.status);

  const handleDelete = async () => {
    if (!winner || isBlocked) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('winners').delete().eq('id', winner.id);
      if (error) throw error;

      await insertAuditLog({
        actionId: winner.actionId,
        actionName,
        tableName: 'winners',
        recordId: winner.id,
        operation: 'delete',
        changes: {
          winner_name: winner.name,
          prize_title: winner.prizeTitle,
          value: winner.value,
          status: winner.status,
          reason: reason.trim() || 'Sem motivo informado',
        },
      });

      queryClient.invalidateQueries({ queryKey: ['winners'] });
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      toast.success('Ganhador excluído.');
      onOpenChange(false);
      setReason('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir ganhador.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) setReason(''); onOpenChange(v); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir Ganhador
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isBlocked ? (
                <p className="text-destructive font-medium">
                  Não é possível excluir ganhador com status "Comprovante Anexado" ou "Comprovante Enviado".
                </p>
              ) : (
                <>
                  <p>
                    Deseja excluir <strong className="text-foreground">{winner?.name}</strong>?
                    Esta ação não pode ser desfeita.
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Motivo (opcional)</label>
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Motivo da exclusão..."
                      className="text-sm"
                      maxLength={200}
                    />
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          {!isBlocked && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Excluir
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}