import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { insertAuditLog } from '@/hooks/useAuditLogger';
import { formatCurrency, resolveOperationalPixKey } from '@/lib/format';
import { PIX_TYPE_LABELS } from '@/types';
import type { Winner, PixType } from '@/types';
import * as XLSX from 'xlsx';

const PIX_TRANSACTION_TYPES: Record<string, string> = {
  cpf: 'Pix - CPF',
  cnpj: 'Pix - CNPJ',
  email: 'Pix - Email',
  phone: 'Pix - Celular',
  random: 'Pix - Aleatória',
};

interface BatchGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winners: Winner[];
  actionId: string;
  actionName: string;
  userName: string;
  actionsMap?: Record<string, string>;
}

function isEligibleForBatch(w: Winner): boolean {
  const isForcarPix = w.status === 'forcar_pix';

  if (isForcarPix) {
    return (
      w.value > 0 &&
      (!!w.cpf || !!w.phone) &&
      !w.batchId
    );
  }

  return (
    !!w.pixKey &&
    !!w.pixType &&
    w.value > 0 &&
    !['receipt_attached', 'receipt_sent'].includes(w.status) &&
    !w.batchId
  );
}

function getOperationalPixData(w: Winner): { pixKey: string; pixType: PixType } {
  const resolved = resolveOperationalPixKey(w.pixKey, w.cpf, w.phone, w.status);
  if (resolved.key && resolved.source === 'pix' && w.pixType) {
    return { pixKey: resolved.key, pixType: w.pixType };
  }
  if (resolved.key && resolved.source === 'cpf') {
    return { pixKey: resolved.key, pixType: 'cpf' };
  }
  if (resolved.key && resolved.source === 'phone') {
    return { pixKey: resolved.key, pixType: 'phone' };
  }
  if (w.pixKey && w.pixType) return { pixKey: w.pixKey, pixType: w.pixType };
  if (w.cpf) return { pixKey: w.cpf.replace(/\D/g, ''), pixType: 'cpf' };
  if (w.phone) return { pixKey: w.phone.replace(/\D/g, ''), pixType: 'phone' };
  return { pixKey: '', pixType: 'cpf' };
}

export function BatchGeneratorModal({
  open, onOpenChange, winners, actionId, actionName, userName, actionsMap,
}: BatchGeneratorModalProps) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const eligible = useMemo(() => winners.filter(isEligibleForBatch), [winners]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === eligible.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligible.map(w => w.id)));
    }
  };

  const selected = useMemo(() => eligible.filter(w => selectedIds.has(w.id)), [eligible, selectedIds]);
  const totalValue = selected.reduce((s, w) => s + w.value, 0);

  const handleGenerate = async () => {
    if (selected.length === 0) return;
    setGenerating(true);

    try {
      const now = new Date().toISOString();
      const byAction = new Map<string, Winner[]>();

      for (const w of selected) {
        const group = byAction.get(w.actionId) || [];
        group.push(w);
        byAction.set(w.actionId, group);
      }

      const actionIds = Array.from(byAction.keys());
      const { data: actionsData, error: actionsError } = await supabase
        .from('actions')
        .select('id, name')
        .in('id', actionIds);

      if (actionsError) throw actionsError;

      const actionNamesById = new Map((actionsData || []).map(action => [action.id, action.name]));
      const allRows: Record<string, any>[] = [];

      for (const [aId, group] of byAction) {
        const winnerActionName = group.find(w => w.actionName?.trim())?.actionName?.trim();
        const fetchedActionName = actionNamesById.get(aId)?.trim();
        const mappedActionName = actionsMap?.[aId]?.trim();
        const propActionName = aId === actionId ? actionName.trim() : '';
        const resolvedActionName = winnerActionName || fetchedActionName || mappedActionName || propActionName || 'Ação';
        const groupTotal = group.reduce((s, w) => s + w.value, 0);
        const filename = `lote_pix_${resolvedActionName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

        const { data: batch, error: batchError } = await supabase
          .from('pix_batches')
          .insert({
            action_id: aId,
            generated_by: userName,
            generated_at: now,
            winner_count: group.length,
            total_value: groupTotal,
            filename,
          } as any)
          .select('id')
          .single();

        if (batchError) throw batchError;

        const winnerIds = group.map(w => w.id);
        const { error: updateError } = await supabase
          .from('winners')
          .update({
            status: 'sent_to_batch' as any,
            batch_id: batch.id,
            payment_method: 'lote_pix' as any,
            updated_at: now,
          } as any)
          .in('id', winnerIds);

        if (updateError) throw updateError;

        for (const w of group) {
          const { pixKey, pixType } = getOperationalPixData(w);
          const prizeLabel = w.prizeTitle || w.prizeType || 'Prêmio';
          const description = `AÇÃO - ${resolvedActionName} - ${prizeLabel}`.slice(0, 240);

          allRows.push({
            'Apelido': w.name,
            'Tipo de Transação': PIX_TRANSACTION_TYPES[pixType] || 'Pix - Celular',
            'Dados de Pagamento (Número do Boleto ou Chave Pix)': pixKey,
            'Valor (R$)': w.value,
            'Categoria (Opcional)': prizeLabel,
            'Centro de Custo (Opcional)': 'Premiações Instantâneas',
            'Descrição (Opcional) (Max. 240 Caractéres)': description,
            ...(w.status === 'forcar_pix' ? { 'Observação': 'FORÇAR PIX - Dados operacionais' } : {}),
          });
        }

        await insertAuditLog({
          actionId: aId,
          actionName: resolvedActionName,
          tableName: 'winners',
          operation: 'lote_pix_gerado',
          changes: {
            batch_id: batch.id,
            winner_count: group.length,
            total_value: groupTotal,
            winners: group.map(w => w.name).join(', '),
            status: { before: 'various', after: 'sent_to_batch' },
          },
        });
      }

      const MAX_SIZE = 2 * 1024 * 1024;
      const filenameActionBase = selected.length === 1
        ? (selected[0].actionName || actionsMap?.[selected[0].actionId] || actionName || 'lote_pix').trim()
        : (actionName || 'lote_pix').trim();
      const baseFilename = `lote_pix_${filenameActionBase.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

      const buildWorkbook = (rows: Record<string, any>[]) => {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Lote PIX');
        ws['!cols'] = [
          { wch: 25 }, { wch: 18 }, { wch: 50 }, { wch: 12 },
          { wch: 20 }, { wch: 25 }, { wch: 50 },
        ];
        return wb;
      };

      const fullWb = buildWorkbook(allRows);
      const fullBuf = XLSX.write(fullWb, { type: 'array', bookType: 'xlsx' });

      if (fullBuf.byteLength <= MAX_SIZE) {
        XLSX.writeFile(fullWb, `${baseFilename}.xlsx`);
      } else {
        let chunkStart = 0;
        let part = 1;

        while (chunkStart < allRows.length) {
          let chunkEnd = allRows.length;
          let buf: ArrayBuffer;

          while (chunkEnd > chunkStart + 1) {
            const mid = Math.floor((chunkStart + chunkEnd) / 2);
            const testWb = buildWorkbook(allRows.slice(chunkStart, mid));
            buf = XLSX.write(testWb, { type: 'array', bookType: 'xlsx' });

            if (buf.byteLength <= MAX_SIZE) {
              chunkEnd = mid;
              const testWb2 = buildWorkbook(allRows.slice(chunkStart, chunkEnd + Math.floor((allRows.length - chunkEnd) / 2)));
              const buf2 = XLSX.write(testWb2, { type: 'array', bookType: 'xlsx' });
              if (buf2.byteLength <= MAX_SIZE) {
                chunkEnd = chunkStart + Math.floor((chunkEnd - chunkStart + (allRows.length - chunkEnd) / 2));
              }
              break;
            } else {
              chunkEnd = mid;
            }
          }

          const chunkWb = buildWorkbook(allRows.slice(chunkStart, chunkEnd));
          XLSX.writeFile(chunkWb, `${baseFilename}_parte${part}.xlsx`);
          chunkStart = chunkEnd;
          part++;
        }

        toast.info(`Arquivo dividido em ${part - 1} partes (limite 2MB por arquivo).`);
      }

      await queryClient.invalidateQueries({ queryKey: ['winners'] });
      toast.success(`Lote PIX gerado com ${selected.length} ganhadores!`);
      setSelectedIds(new Set());
      onOpenChange(false);
    } catch (err) {
      console.error('Batch generation error:', err);
      toast.error('Erro ao gerar lote PIX.');
    } finally {
      setGenerating(false);
    }
  };

  const ineligible = winners.filter(w => !isEligibleForBatch(w) && !['receipt_attached', 'receipt_sent'].includes(w.status));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Gerar Lote PIX
          </DialogTitle>
          <DialogDescription>
            Selecione os ganhadores para incluir no arquivo de lote bancário (.xlsx)
          </DialogDescription>
        </DialogHeader>

        {eligible.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-warning" />
            Nenhum ganhador elegível para lote. Os ganhadores precisam ter chave PIX, valor e não estar em "Comprovante Anexado/Enviado" ou já vinculados a outro lote.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === eligible.length && eligible.length > 0}
                  onCheckedChange={selectAll}
                />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size}/{eligible.length} selecionados
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">
                  {formatCurrency(totalValue)}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[400px] border rounded-lg">
              <div className="divide-y">
                {eligible.map(w => (
                  <label
                    key={w.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.has(w.id)}
                      onCheckedChange={() => toggleId(w.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{w.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(() => {
                          const { pixType } = getOperationalPixData(w);
                          const label = PIX_TYPE_LABELS[pixType];
                          return w.status === 'forcar_pix' && !w.pixKey
                            ? `${label} (operacional)`
                            : label;
                        })()} · {w.prizeTitle}
                      </p>
                    </div>
                    <span className="text-sm font-medium shrink-0">{formatCurrency(w.value)}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>

            {ineligible.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {ineligible.length} ganhador(es) não elegíveis (sem chave PIX, valor ou já em lote)
              </p>
            )}
          </>
        )}

        <Separator />

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating || selectedIds.size === 0}
            className="gap-1.5"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Gerar Lote ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
