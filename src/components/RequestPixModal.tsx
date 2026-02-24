import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Send, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Winner } from '@/types';

interface RequestPixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winners: Winner[];
  onConfirm: () => Promise<void>;
  isPending: boolean;
  isAdmin: boolean;
}

const ALLOWED_STATUSES = ['imported', 'pix_requested'];

const STATUS_LABELS: Record<string, string> = {
  imported: 'Importado',
  pix_requested: 'Pix Solicitado (reenvio)',
};

export function RequestPixModal({
  open,
  onOpenChange,
  winners,
  onConfirm,
  isPending,
  isAdmin,
}: RequestPixModalProps) {
  const eligible = winners.filter((w) => ALLOWED_STATUSES.includes(w.status));
  const blocked = winners.filter((w) => !ALLOWED_STATUSES.includes(w.status));
  const noPhone = eligible.filter((w) => !w.phone || w.phone.replace(/\D/g, '').length < 10);
  const ready = eligible.filter((w) => w.phone && w.phone.replace(/\D/g, '').length >= 10);

  const totalValue = ready.reduce((s, w) => s + w.value, 0);
  const resendCount = ready.filter((w) => w.status === 'pix_requested').length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Solicitar PIX
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              {ready.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="font-medium text-foreground">
                    {ready.length} ganhador(es) serão notificados
                  </p>
                  {isAdmin && (
                    <p className="text-xs text-muted-foreground">
                      Valor total: <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
                    </p>
                  )}
                  {resendCount > 0 && (
                    <p className="text-xs text-warning">
                      ⚠️ {resendCount} já com status "Pix Solicitado" (será reenviado)
                    </p>
                  )}
                </div>
              )}

              {noPhone.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <p className="text-xs text-warning flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {noPhone.length} ganhador(es) sem telefone válido — serão ignorados.
                  </p>
                </div>
              )}

              {blocked.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {blocked.length} ganhador(es) com status incompatível — bloqueados.
                  </p>
                </div>
              )}

              {ready.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Isso irá enviar uma mensagem oficial no WhatsApp via n8n/UnniChat.
                </p>
              )}

              {ready.length === 0 && (
                <p className="text-sm text-destructive font-medium">
                  Nenhum ganhador elegível para solicitar Pix.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button
            onClick={onConfirm}
            disabled={isPending || ready.length === 0}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            Confirmar Solicitação
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Helper to filter only eligible winners from a selection */
export function getEligibleWinners(winners: Winner[]): Winner[] {
  return winners.filter(
    (w) => ALLOWED_STATUSES.includes(w.status) && w.phone && w.phone.replace(/\D/g, '').length >= 10
  );
}
