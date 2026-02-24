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
import { formatCurrency } from '@/lib/format';
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
}

function isEligibleForBatch(w: Winner): boolean {
  return (
    !!w.pixKey &&
    !!w.pixType &&
    w.value > 0 &&
    !['receipt_attached', 'receipt_sent'].includes(w.status) &&
    !w.batchId
  );
}

export function BatchGeneratorModal({
  open, onOpenChange, winners, actionId, actionName, userName,
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
      // 1. Create batch record
      const now = new Date().toISOString();
      const filename = `lote_pix_${actionName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const { data: batch, error: batchError } = await supabase
        .from('pix_batches')
        .insert({
          action_id: actionId,
          generated_by: userName,
          generated_at: now,
          winner_count: selected.length,
          total_value: totalValue,
          filename,
        } as any)
        .select('id')
        .single();

      if (batchError) throw batchError;

      // 2. Update winners: status → sent_to_batch, link batch, set payment_method
      const winnerIds = selected.map(w => w.id);
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

      // 3. Generate XLSX
      const description = `AÇÃO - ${actionId.slice(0, 8)} - ${actionName}`.slice(0, 240);
      const rows = selected.map(w => ({
        'Apelido': w.name,
        'Tipo de Transação': PIX_TRANSACTION_TYPES[w.pixType || ''] || 'Pix',
        'Dados de Pagamento': w.pixKey || '',
        'Valor': w.value,
        'Categoria': w.prizeTitle || w.prizeType,
        'Centro de Custo': 'Premiações Instantâneas',
        'Descrição': description,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Lote PIX');

      // Set column widths
      ws['!cols'] = [
        { wch: 25 }, { wch: 18 }, { wch: 35 }, { wch: 12 },
        { wch: 20 }, { wch: 25 }, { wch: 50 },
      ];

      XLSX.writeFile(wb, filename);

      // 4. Audit log
      await insertAuditLog({
        actionId,
        actionName,
        tableName: 'winners',
        operation: 'lote_pix_gerado',
        changes: {
          batch_id: batch.id,
          winner_count: selected.length,
          total_value: totalValue,
          winners: selected.map(w => w.name).join(', '),
          status: { before: 'various', after: 'sent_to_batch' },
        },
      });

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
                        {w.pixType ? PIX_TYPE_LABELS[w.pixType as PixType] : '—'} · {w.prizeTitle}
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
