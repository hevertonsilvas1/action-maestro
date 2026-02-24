import { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Upload, Download, Trash2, RefreshCw, Send, FileText, Paperclip, MessageSquare, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { insertAuditLog } from '@/hooks/useAuditLogger';
import type { Winner } from '@/types';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const RECEIPT_ELIGIBLE_STATUSES = ['sent_to_batch', 'pix_received', 'pix_refused', 'receipt_attached', 'receipt_sent'];

interface ReceiptManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winner: Winner | null;
  userName: string;
  actionId: string;
  actionName: string;
}

function isWindowOpen(winner: Winner, windowHours = 24): boolean {
  if (!winner.ultimaInteracaoWhatsapp) return false;
  const lastInbound = new Date(winner.ultimaInteracaoWhatsapp).getTime();
  const now = Date.now();
  return (now - lastInbound) < windowHours * 60 * 60 * 1000;
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

  const storagePath = `${actionId}/${winner.id}`;

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
          updated_at: now,
        } as any)
        .eq('id', winner.id);
      if (updateError) throw updateError;

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

  // --- Send Receipt (hybrid) ---
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
          winner_phone: (winner.phone || '').replace(/\D/g, ''),
          action_id: actionId,
          action_name: actionName,
          prize_title: winner.prizeTitle,
          prize_value: winner.value,
          receipt_path: winner.receiptUrl,
          mode,
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
    toast.info('Registrado como pendente para envio manual.');
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

        {/* Status */}
        <div className="flex items-center gap-2 flex-wrap">
          {!hasReceipt ? (
            <Badge variant="outline" className="text-muted-foreground gap-1">
              Sem comprovante
            </Badge>
          ) : (
            <Badge variant="outline" className="text-success gap-1 border-success/30 bg-success/5">
              <Paperclip className="h-3 w-3" />
              Anexado
            </Badge>
          )}
          {winner.receiptVersion > 0 && (
            <Badge variant="outline" className="text-[10px]">
              Versão {winner.receiptVersion}
            </Badge>
          )}
          {/* Window indicator */}
          {hasReceipt && (
            <Badge variant="outline" className={`text-[10px] gap-1 ${windowOpen ? 'border-success/30 text-success' : 'border-warning/30 text-warning'}`}>
              <Clock className="h-3 w-3" />
              {windowOpen ? 'Janela aberta' : 'Janela fechada'}
            </Badge>
          )}
        </div>

        {/* Receipt details */}
        {hasReceipt && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-xs font-medium">{winner.receiptFilename || 'Comprovante'}</p>
            {winner.receiptAttachedAt && (
              <p className="text-[10px] text-muted-foreground">
                Anexado em: {new Date(winner.receiptAttachedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
            {winner.receiptAttachedBy && (
              <p className="text-[10px] text-muted-foreground">
                Anexado por: {winner.receiptAttachedBy}
              </p>
            )}
            {winner.receiptSentAt && (
              <p className="text-[10px] text-muted-foreground">
                Enviado ao cliente em: {new Date(winner.receiptSentAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
            {winner.ultimaInteracaoWhatsapp && (
              <p className="text-[10px] text-muted-foreground">
                Última interação: {new Date(winner.ultimaInteracaoWhatsapp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
            {winner.lastPixError && (
              <p className="text-[10px] text-destructive">
                Último erro: {winner.lastPixError}
              </p>
            )}
          </div>
        )}

        {!canUpload && !hasReceipt && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            O comprovante só pode ser anexado quando o ganhador estiver em "Pix Recebido / Validado", "Enviado para Lote" ou "Pix Recusado".
          </div>
        )}

        {/* Manual options modal (window closed) */}
        {showManualOptions && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-warning">Janela de envio fechada</p>
                <p className="text-[10px] text-muted-foreground">
                  O cliente não interagiu recentemente. O envio automático não é possível. Escolha uma opção:
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => doSendReceipt('confirmation')}
                disabled={isBusy}
                className="gap-1.5 justify-start"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Pedir confirmação ao cliente
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkPending}
                disabled={isBusy}
                className="gap-1.5 justify-start"
              >
                <Clock className="h-4 w-4" />
                Marcar como pendente (envio manual)
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

            {canSendReceipt && (
              <Button
                size="sm"
                onClick={handleSendReceipt}
                disabled={isBusy}
                className="gap-1.5"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Comprovante
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
