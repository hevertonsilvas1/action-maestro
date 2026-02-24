import { useState } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { insertAuditLog } from '@/hooks/useAuditLogger';
import type { Winner } from '@/types';

const BLOCKED_STATUSES = ['receipt_attached', 'receipt_sent', 'sent_to_batch'];

interface BulkDeleteWinnersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winners: Winner[];
  actionsMap: Record<string, string>;
  onDone: () => void;
}

export function BulkDeleteWinnersDialog({ open, onOpenChange, winners, actionsMap, onDone }: BulkDeleteWinnersDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const eligible = winners.filter(w => !BLOCKED_STATUSES.includes(w.status));
  const blocked = winners.filter(w => BLOCKED_STATUSES.includes(w.status));

  const handleBulkDelete = async () => {
    if (eligible.length === 0) return;
    setDeleting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      let userName = user?.email || 'Sistema';

      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('signature, display_name')
          .eq('user_id', userId)
          .maybeSingle();
        userName = profile?.signature || profile?.display_name || userName;
      }

      const now = new Date().toISOString();
      const ids = eligible.map(w => w.id);

      const { error } = await supabase
        .from('winners')
        .update({ deleted_at: now, deleted_by: userName } as any)
        .in('id', ids);

      if (error) throw error;

      // Group by action for audit
      const byAction: Record<string, string[]> = {};
      eligible.forEach(w => {
        if (!byAction[w.actionId]) byAction[w.actionId] = [];
        byAction[w.actionId].push(w.id);
      });

      await Promise.all(
        Object.entries(byAction).map(([actionId, winnerIds]) =>
          insertAuditLog({
            actionId,
            actionName: actionsMap[actionId] || '',
            tableName: 'winners',
            operation: 'BULK_DELETE_WINNERS',
            changes: { winner_ids: winnerIds, deleted_by: userName, count: winnerIds.length },
          })
        )
      );

      queryClient.invalidateQueries({ queryKey: ['winners'] });
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      toast.success(`${eligible.length} ganhador(es) excluído(s)`);
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao excluir', { description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir ganhadores selecionados
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {eligible.length > 0 && (
                <p>
                  <Badge variant="outline" className="mr-1">{eligible.length}</Badge>
                  ganhador(es) serão marcados como excluídos.
                </p>
              )}
              {blocked.length > 0 && (
                <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  <p className="font-medium mb-1">
                    {blocked.length} ganhador(es) não podem ser excluídos:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {blocked.slice(0, 5).map(w => (
                      <li key={w.id}>{w.name} — {w.status === 'sent_to_batch' ? 'Enviado para Lote' : w.status === 'receipt_attached' ? 'Comprovante Anexado' : 'Comprovante Enviado'}</li>
                    ))}
                    {blocked.length > 5 && <li>...e mais {blocked.length - 5}</li>}
                  </ul>
                </div>
              )}
              {eligible.length === 0 && (
                <p className="text-sm">Nenhum dos ganhadores selecionados pode ser excluído.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={deleting || eligible.length === 0}
          >
            {deleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Excluir {eligible.length > 0 ? `(${eligible.length})` : ''}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
