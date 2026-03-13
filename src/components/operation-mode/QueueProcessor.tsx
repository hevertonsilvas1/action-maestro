import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Send, SkipForward, CheckCircle2, Upload, CreditCard, PackagePlus,
  Loader2, Phone, User, FileText, Trophy, Banknote, Building2, Copy, AlertTriangle
} from 'lucide-react';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { insertAuditLog } from '@/hooks/useAuditLogger';
import { formatCurrency } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { ReceiptManager } from '@/components/ReceiptManager';
import { PixDataModal } from '@/components/PixDataModal';
import type { Winner, Action } from '@/types';

// Map status slugs to their primary operational action
const STATUS_ACTIONS: Record<string, { label: string; icon: typeof Send; action: string }> = {
  imported: { label: 'Solicitar PIX', icon: Send, action: 'request_pix' },
  pix_requested: { label: 'Reenviar solicitação PIX', icon: Send, action: 'request_pix' },
  awaiting_pix: { label: 'Reenviar solicitação PIX', icon: Send, action: 'request_pix' },
  cliente_nao_responde: { label: 'Reenviar solicitação PIX', icon: Send, action: 'request_pix' },
  forcar_pix: { label: 'Adicionar ao lote', icon: PackagePlus, action: 'add_to_batch' },
  pix_received: { label: 'Adicionar ao lote', icon: PackagePlus, action: 'add_to_batch' },
  ready_to_pay: { label: 'Adicionar ao lote', icon: PackagePlus, action: 'add_to_batch' },
  sent_to_batch: { label: 'Anexar comprovante', icon: Upload, action: 'attach_receipt' },
  awaiting_receipt: { label: 'Anexar comprovante', icon: Upload, action: 'attach_receipt' },
  pix_refused: { label: 'Editar dados PIX', icon: CreditCard, action: 'edit_pix' },
  receipt_attached: { label: 'Enviar comprovante', icon: Send, action: 'send_receipt' },
  paid: { label: 'Anexar comprovante', icon: Upload, action: 'attach_receipt' },
};

interface QueueProcessorProps {
  winner: Winner | null;
  statusSlug: string;
  actionsMap: Record<string, Action>;
  processedCount: number;
  totalCount: number;
  remainingCount: number;
  onNext: () => void;
  onSkip: () => void;
  isAdmin: boolean;
  userName: string;
}

export function QueueProcessor({
  winner, statusSlug, actionsMap, processedCount, totalCount, remainingCount,
  onNext, onSkip, isAdmin, userName,
}: QueueProcessorProps) {
  const { getLabel, getColor } = useWinnerStatusMap();
  const queryClient = useQueryClient();
  const [executing, setExecuting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const progressPercent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;
  const statusAction = STATUS_ACTIONS[statusSlug];
  const statusColor = getColor(statusSlug);
  const statusLabel = getLabel(statusSlug);

  // Queue completed
  if (!winner) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-success" />
        <h2 className="text-2xl font-bold text-foreground">Fila concluída!</h2>
        <p className="text-muted-foreground">
          Todos os {totalCount} registros da fila <strong>{statusLabel}</strong> foram processados.
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{processedCount} processados</Badge>
        </div>
      </div>
    );
  }

  const action = actionsMap[winner.actionId];
  const actionName = action?.name || '';

  const handlePrimaryAction = async () => {
    if (!statusAction) return;

    switch (statusAction.action) {
      case 'request_pix':
        await handleRequestPix();
        break;
      case 'attach_receipt':
      case 'send_receipt':
        setReceiptOpen(true);
        return; // Don't auto-next, modal handles it
      case 'edit_pix':
        setPixModalOpen(true);
        return;
      case 'add_to_batch':
        // For batch, just mark as processed and move on — batch is done from the main UI
        toast.info('Registrado para lote. Use o Gerador de Lote na tela principal para processar.');
        onNext();
        return;
    }
  };

  const handleRequestPix = async () => {
    setExecuting(true);
    try {
      const payload = [{
        winner_id: winner.id,
        winner_name: winner.name,
        winner_phone: winner.phoneE164 || (winner.phone || '').replace(/\D/g, ''),
        action_id: winner.actionId,
        action_name: actionName,
        prize_type: winner.prizeType,
        prize_title: winner.prizeTitle,
        prize_value: winner.value,
      }];

      const { data, error } = await supabase.functions.invoke('request-pix', {
        body: { winners: payload },
      });

      if (error) throw error;

      const results = data?.results ?? [];
      const success = results[0]?.success;

      if (success) {
        toast.success(`PIX solicitado para ${winner.name}`);
      } else {
        toast.error(results[0]?.error || 'Erro ao solicitar PIX');
      }

      await queryClient.invalidateQueries({ queryKey: ['winners'] });
      onNext();
    } catch (err) {
      console.error('Request PIX error:', err);
      toast.error('Erro ao solicitar PIX');
    } finally {
      setExecuting(false);
    }
  };

  const handleReceiptClose = (open: boolean) => {
    setReceiptOpen(open);
    if (!open) {
      // Refresh and move to next after receipt action
      queryClient.invalidateQueries({ queryKey: ['winners'] });
      onNext();
    }
  };

  const handlePixModalClose = (open: boolean) => {
    setPixModalOpen(open);
    if (!open) {
      queryClient.invalidateQueries({ queryKey: ['winners'] });
      onNext();
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const operationalKey = winner.cpf || winner.phone || null;
  const operationalKeyType = winner.cpf ? 'CPF' : winner.phone ? 'Telefone' : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Queue Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <span className="text-sm font-semibold">Fila: {statusLabel}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {processedCount} / {totalCount} processados
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {remainingCount} restante{remainingCount !== 1 ? 's' : ''}
            </span>
            <span className="text-xs font-medium text-primary">{progressPercent}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Winner Card */}
      <Card className="border-l-4" style={{ borderLeftColor: statusColor }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{winner.name}</CardTitle>
            <StatusBadge status={winner.status} />
          </div>
          {winner.fullName && winner.fullName !== winner.name && (
            <p className="text-sm text-muted-foreground">{winner.fullName}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <InfoItem
              icon={Phone}
              label="Telefone"
              value={winner.phone || '—'}
              copyable={!!winner.phone}
              onCopy={() => winner.phone && copyToClipboard(winner.phone, 'Telefone')}
            />
            <InfoItem
              icon={FileText}
              label="CPF"
              value={winner.cpf || '—'}
              copyable={!!winner.cpf}
              onCopy={() => winner.cpf && copyToClipboard(winner.cpf, 'CPF')}
            />
            <InfoItem
              icon={Trophy}
              label="Prêmio"
              value={winner.prizeTitle}
            />
            <InfoItem
              icon={Banknote}
              label="Valor"
              value={formatCurrency(winner.value)}
            />
            <InfoItem
              icon={Building2}
              label="Ação"
              value={actionName || '—'}
            />
            <InfoItem
              icon={CreditCard}
              label="Chave PIX"
              value={winner.pixKey || '—'}
              copyable={!!winner.pixKey}
              onCopy={() => winner.pixKey && copyToClipboard(winner.pixKey, 'Chave PIX')}
            />
          </div>

          {/* Operational Key Highlight */}
          {statusSlug === 'forcar_pix' && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-xs font-semibold text-warning">Chave Operacional</span>
              </div>
              {operationalKey ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{operationalKeyType}: {operationalKey}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(operationalKey, operationalKeyType || 'Chave')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-destructive">Nenhuma chave operacional disponível</p>
              )}
            </div>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {statusAction ? (
              <Button
                onClick={handlePrimaryAction}
                disabled={executing}
                className="flex-1 h-12 text-base font-semibold"
                style={{ backgroundColor: statusColor }}
              >
                {executing ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <statusAction.icon className="h-5 w-5 mr-2" />
                )}
                {statusAction.label}
              </Button>
            ) : (
              <Button
                onClick={onNext}
                className="flex-1 h-12 text-base font-semibold"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Marcar como processado
              </Button>
            )}

            <Button
              variant="outline"
              onClick={onSkip}
              className="h-12 px-6"
              disabled={executing}
            >
              <SkipForward className="h-5 w-5 mr-1" />
              Pular
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Manager Modal */}
      {winner && (
        <ReceiptManager
          open={receiptOpen}
          onOpenChange={handleReceiptClose}
          winner={winner}
          userName={userName}
          actionId={winner.actionId}
          actionName={actionName}
        />
      )}

      {/* PIX Data Modal */}
      {winner && (
        <PixDataModal
          open={pixModalOpen}
          onOpenChange={handlePixModalClose}
          winner={winner}
          isAdmin={isAdmin}
          userName={userName}
          actionId={winner.actionId}
        />
      )}
    </div>
  );
}

function InfoItem({
  icon: Icon, label, value, copyable, onCopy,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  copyable?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-foreground truncate">{value}</span>
        {copyable && onCopy && (
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onCopy}>
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
