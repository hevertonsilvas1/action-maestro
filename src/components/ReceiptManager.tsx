import { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Upload, Download, Trash2, RefreshCw, Send, FileText, Paperclip, MessageSquare, Clock, AlertTriangle, CheckCircle2, XCircle, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { insertAuditLog } from '@/hooks/useAuditLogger';
import type { Winner } from '@/types';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const RECEIPT_ELIGIBLE_STATUSES = ['pix_received', 'ready_to_pay', 'sent_to_batch', 'awaiting_receipt', 'pix_refused', 'receipt_attached', 'receipt_sent', 'paid'];

interface ReceiptManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winner: Winner | null;
  userName: string;
  actionId: string;
  actionName: string;
}

function isWindowOpen(winner: Winner, windowHours = 24): boolean {
  if (!winner.lastInboundAt) return false;
  const lastInbound = new Date(winner.lastInboundAt).getTime();
  const now = Date.now();
  return (now - lastInbound) < windowHours * 60 * 60 * 1000;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function getTimeSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `há ${hours}h${minutes > 0 ? `${minutes}min` : ''}`;
  return `há ${minutes}min`;
}

export function ReceiptManager({ open, onOpenChange, winner, userName, actionId, actionName }: ReceiptManagerProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [showManualOptions, setShowManualOptions] = useState(false);

  if (!winner) return null;

  const hasReceipt = !!winner.receiptUrl;
  const canUpload = RECEIPT_ELIGIBLE_STATUSES.includes(winner.status);
  const canSendReceipt = (winner.status === 'receipt_attached') && hasReceipt;
  const windowOpen = isWindowOpen(winner);
  const receiptAlreadySent = !!winner.receiptSentAt;
  const hasPendingTemplate = (winner.templateReopenCount || 0) > 0;

  const storagePath = `${actionId}/${winner.id}`;

  // --- Auto-send attempt after attach ---
  const tryAutoSend = async (receiptPath: string) => {
    if (!winner.phoneE164 || winner.receiptSentAt) return;

    if (isWindowOpen(winner)) {
      // Window open → send immediately
      try {
        const { data, error } = await supabase.functions.invoke('send-receipt', {
          body: {
            winner_id: winner.id,
            winner_name: winner.name,
            winner_phone: winner.phoneE164,
            action_id: actionId,
            action_name: actionName,
            prize_title: winner.prizeTitle,
            prize_value: winner.value,
            receipt_path: receiptPath,
            trigger: 'auto_attach',
          },
        });

        if (error) {
          console.error('Auto-send error:', error);
          return;
        }

        if (data?.success) {
          await queryClient.invalidateQueries({ queryKey: ['winners'] });
          toast.success('Comprovante enviado automaticamente ao ganhador!');
        } else if (data?.error) {
          toast.warning(`Comprovante anexado, mas envio automático falhou: ${data.error}`);
        }
      } catch (err) {
        console.error('Auto-send exception:', err);
      }
    } else {
      // Window closed → send "abrir_janela" template to reopen window
      try {
        const { data, error } = await supabase.functions.invoke('send-receipt', {
          body: {
            winner_id: winner.id,
            winner_name: winner.name,
            winner_phone: winner.phoneE164,
            action_id: actionId,
            action_name: actionName,
            prize_title: winner.prizeTitle,
            prize_value: winner.value,
            receipt_path: receiptPath,
            mode: 'confirmation',
            trigger: 'auto_attach_template',
          },
        });

        if (error) {
          console.error('Auto template error:', error);
          toast.info('Comprovante anexado. Envio pendente — será enviado quando o cliente interagir.');
          return;
        }

        if (data?.success) {
          await queryClient.invalidateQueries({ queryKey: ['winners'] });
          toast.success('Comprovante anexado. Mensagem enviada ao cliente para abrir a janela de conversa.');
        } else if (data?.skipped) {
          const reasons: Record<string, string> = {
            max_templates_reached: 'Limite de mensagens de reabertura atingido.',
            template_cooldown: 'Aguarde antes de enviar outra mensagem de reabertura.',
          };
          toast.info(`Comprovante anexado. ${reasons[data.reason] || 'Envio pendente.'}`);
        } else {
          toast.info('Comprovante anexado. Envio pendente — será enviado quando o cliente interagir.');
        }
      } catch (err) {
        console.error('Auto template exception:', err);
        toast.info('Comprovante anexado. Envio pendente — será enviado quando o cliente interagir.');
      }
    }
  };

  // --- Upload ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Formato não permitido. Use PDF, JPG ou PNG.');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setUploading(true);
    try {
      const isReplace = hasReceipt;
      const newVersion = (winner.receiptVersion || 0) + 1;
      const ext = file.name.split('.').pop();
      const fileName = `comprovante_v${newVersion}.${ext}`;
      const fullPath = `${storagePath}/${fileName}`;

      if (isReplace && winner.receiptUrl) {
        const oldPath = extractStoragePath(winner.receiptUrl);
        if (oldPath) {
          await supabase.storage.from('receipts').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fullPath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const now = new Date().toISOString();
      const paymentMethod = winner.paymentMethod || 'manual';

      const { error: updateError } = await supabase
        .from('winners')
        .update({
          receipt_url: fullPath,
          receipt_filename: file.name,
          receipt_attached_at: now,
          receipt_attached_by: userName,
          receipt_version: newVersion,
          status: 'receipt_attached' as any,
          payment_method: paymentMethod as any,
          last_pix_error: null,
          updated_at: now,
        } as any)
        .eq('id', winner.id);
      if (updateError) throw updateError;

      // Apply automatic status transition if configured
      await supabase.rpc('apply_automatic_status_transition' as any, {
        _winner_id: winner.id,
        _trigger_event: 'receipt_attached',
      });

      await insertAuditLog({
        actionId,
        actionName,
        tableName: 'winners',
        recordId: winner.id,
        operation: isReplace ? 'comprovante_substituido' : 'comprovante_anexado',
        changes: {
          winner_name: winner.name,
          filename: file.name,
          version: newVersion,
          status: { before: winner.status, after: 'receipt_attached' },
        },
      });

      await queryClient.invalidateQueries({ queryKey: ['winners'] });
      toast.success(isReplace ? 'Comprovante substituído com sucesso!' : 'Comprovante anexado com sucesso!');

      // Attempt auto-send (non-blocking)
      tryAutoSend(fullPath);

      onOpenChange(false);
    } catch (err) {
      console.error('Upload receipt error:', err);
      toast.error('Erro ao enviar comprovante.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // --- Download ---
  const handleDownload = async () => {
    if (!winner.receiptUrl) return;
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(winner.receiptUrl, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Erro ao baixar comprovante.');
    }
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (!winner.receiptUrl) return;
    setDeleting(true);
    try {
      const { error: storageError } = await supabase.storage
        .from('receipts')
        .remove([winner.receiptUrl]);
      if (storageError) throw storageError;

      const now = new Date().toISOString();
      const revertStatus = winner.batchId ? 'sent_to_batch' : 'pix_received';

      const { error: updateError } = await supabase
        .from('winners')
        .update({
          receipt_url: null,
          receipt_filename: null,
          receipt_attached_at: null,
          receipt_attached_by: null,
          receipt_sent_at: null,
          receipt_version: 0,
          status: revertStatus as any,
          updated_at: now,
        })
        .eq('id', winner.id);
      if (updateError) throw updateError;

      await insertAuditLog({
        actionId,
        actionName,
        tableName: 'winners',
        recordId: winner.id,
        operation: 'comprovante_excluido',
        changes: {
          winner_name: winner.name,
          filename: winner.receiptFilename,
          status: { before: winner.status, after: revertStatus },
        },
      });

      await queryClient.invalidateQueries({ queryKey: ['winners'] });
      toast.success('Comprovante excluído.');
      onOpenChange(false);
    } catch (err) {
      console.error('Delete receipt error:', err);
      toast.error('Erro ao excluir comprovante.');
    } finally {
      setDeleting(false);
    }
  };

  // --- Send Receipt ---
  const handleSendReceipt = async () => {
    if (!winner.receiptUrl) return;

    if (!windowOpen) {
      setShowManualOptions(true);
      return;
    }

    await doSendReceipt('receipt');
  };

  const doSendReceipt = async (mode: 'receipt' | 'confirmation') => {
    setSending(true);
    setShowManualOptions(false);
    try {
      const { data, error } = await supabase.functions.invoke('send-receipt', {
        body: {
          winner_id: winner.id,
          winner_name: winner.name,
          winner_phone: winner.phoneE164 || (winner.phone || '').replace(/\D/g, ''),
          action_id: actionId,
          action_name: actionName,
          prize_title: winner.prizeTitle,
          prize_value: winner.value,
          receipt_path: winner.receiptUrl,
          mode,
          trigger: 'manual',
        },
      });

      if (error) throw error;

      if (data?.success) {
        await queryClient.invalidateQueries({ queryKey: ['winners'] });
        if (mode === 'confirmation') {
          toast.success('Mensagem de confirmação enviada ao ganhador!');
        } else {
          toast.success('Comprovante enviado ao ganhador com sucesso!');
        }
        onOpenChange(false);
      } else if (data?.skipped) {
        const reasons: Record<string, string> = {
          receipt_already_sent: 'Comprovante já foi enviado anteriormente.',
          max_templates_reached: 'Limite de templates de reabertura atingido (máx. 3).',
          template_cooldown: 'Aguarde pelo menos 1h entre envios de template.',
          no_automation: 'Automação não encontrada ou inativa. Configure em Configurações → Automações.',
          no_phone_e164: 'Telefone E.164 não cadastrado para este ganhador.',
          no_inbound: 'Sem interação inbound registrada.',
          window_closed: 'Janela de atendimento fechada.',
        };
        toast.warning(reasons[data.reason] || 'Envio ignorado.');
      } else {
        toast.error(data?.error || 'Erro ao enviar.');
      }
    } catch (err) {
      console.error('Send receipt error:', err);
      toast.error('Erro ao enviar comprovante ao ganhador.');
    } finally {
      setSending(false);
    }
  };

  const handleMarkPending = async () => {
    setShowManualOptions(false);
    await insertAuditLog({
      actionId,
      actionName,
      tableName: 'winners',
      recordId: winner.id,
      operation: 'comprovante_pendente_manual',
      changes: {
        winner_name: winner.name,
        note: 'Marcado para envio manual na conversa (janela fechada)',
      },
    });
    toast.info('Registrado como pendente. O comprovante será enviado automaticamente quando o cliente responder.');
    onOpenChange(false);
  };

  const isBusy = uploading || deleting || sending;

  return (
    <Dialog open={open} onOpenChange={(v) => { setShowManualOptions(false); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Comprovante de Pagamento
          </DialogTitle>
          <DialogDescription>
            {winner.name} — {winner.prizeTitle}
          </DialogDescription>
        </DialogHeader>

        {/* ── Status Cards ── */}
        <div className="grid grid-cols-2 gap-2">
          {/* Window status */}
          <div className={`rounded-lg border p-3 ${windowOpen ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {windowOpen ? <Wifi className="h-3.5 w-3.5 text-success" /> : <WifiOff className="h-3.5 w-3.5 text-warning" />}
              <span className={`text-xs font-semibold ${windowOpen ? 'text-success' : 'text-warning'}`}>
                {windowOpen ? 'Janela aberta' : 'Janela fechada'}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {winner.lastInboundAt
                ? `Última interação: ${getTimeSince(winner.lastInboundAt)}`
                : 'Nenhuma interação registrada'}
            </p>
          </div>

          {/* Receipt status */}
          <div className={`rounded-lg border p-3 ${
            receiptAlreadySent
              ? 'border-success/30 bg-success/5'
              : hasReceipt
                ? 'border-primary/30 bg-primary/5'
                : 'border-muted bg-muted/30'
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              {receiptAlreadySent ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              ) : hasReceipt ? (
                <Paperclip className="h-3.5 w-3.5 text-primary" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className={`text-xs font-semibold ${
                receiptAlreadySent ? 'text-success' : hasReceipt ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {receiptAlreadySent ? 'Enviado' : hasReceipt ? 'Anexado (pendente)' : 'Sem comprovante'}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {receiptAlreadySent
                ? formatDateTime(winner.receiptSentAt)
                : hasReceipt
                  ? `Anexado: ${formatDateTime(winner.receiptAttachedAt)}`
                  : 'Nenhum arquivo'}
            </p>
          </div>
        </div>

        {/* ── Receipt details ── */}
        {hasReceipt && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">{winner.receiptFilename || 'Comprovante'}</p>
              {winner.receiptVersion > 0 && (
                <Badge variant="outline" className="text-[10px] h-5">v{winner.receiptVersion}</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <p className="text-[10px] text-muted-foreground">
                Anexado em: {formatDateTime(winner.receiptAttachedAt)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Por: {winner.receiptAttachedBy || '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Enviado em: {formatDateTime(winner.receiptSentAt)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Última interação: {formatDateTime(winner.lastInboundAt)}
              </p>
              {winner.lastOutboundAt && (
                <p className="text-[10px] text-muted-foreground col-span-2">
                  Último outbound: {formatDateTime(winner.lastOutboundAt)}
                </p>
              )}
            </div>
            {hasPendingTemplate && (
              <p className="text-[10px] text-muted-foreground">
                Templates de reabertura enviados: {winner.templateReopenCount}/3
                {winner.templateReopenSentAt && ` (último: ${formatDateTime(winner.templateReopenSentAt)})`}
              </p>
            )}
            {winner.lastPixError && (
              <div className="flex items-start gap-1.5 mt-1">
                <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                <p className="text-[10px] text-destructive leading-tight">{winner.lastPixError}</p>
              </div>
            )}
          </div>
        )}

        {!canUpload && !hasReceipt && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            O comprovante só pode ser anexado quando o ganhador estiver em "Pix Recebido / Validado", "Enviado para Lote" ou "Pix Recusado".
          </div>
        )}

        {/* ── Primary action: Send Receipt ── */}
        {canSendReceipt && !showManualOptions && (
          <Button
            onClick={handleSendReceipt}
            disabled={isBusy}
            className="w-full gap-2"
            size="default"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : windowOpen ? (
              <Send className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            {windowOpen ? 'Enviar Comprovante' : 'Enviar Comprovante (janela fechada)'}
          </Button>
        )}

        {/* ── Manual options (window closed) ── */}
        {showManualOptions && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <WifiOff className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-warning">Janela de atendimento fechada</p>
                <p className="text-[10px] text-muted-foreground">
                  O cliente não interagiu nas últimas 24h. Escolha uma ação:
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => doSendReceipt('confirmation')}
                disabled={isBusy || (winner.templateReopenCount || 0) >= 3}
                size="sm"
                className="gap-1.5 justify-start"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Enviar template de reabertura
                {(winner.templateReopenCount || 0) > 0 && (
                  <span className="text-[10px] opacity-70">({winner.templateReopenCount}/3)</span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkPending}
                disabled={isBusy}
                className="gap-1.5 justify-start"
              >
                <Clock className="h-4 w-4" />
                Marcar como pendente (envio automático no inbound)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManualOptions(false)}
                className="text-muted-foreground"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <Separator />

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* ── Secondary actions ── */}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex flex-wrap gap-2 justify-end">
            {canUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={isBusy}
                className="gap-1.5"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : hasReceipt ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {hasReceipt ? 'Substituir' : 'Anexar Comprovante'}
              </Button>
            )}

            {hasReceipt && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isBusy}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Baixar
              </Button>
            )}

            {hasReceipt && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isBusy}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function extractStoragePath(url: string): string | null {
  if (!url.startsWith('http')) return url;
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/object\/(?:public|sign)\/receipts\/(.+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
