import { useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileSpreadsheet, Package, Download } from 'lucide-react';
import { usePixBatches } from '@/hooks/usePixBatches';
import { formatCurrency, formatDateTime, resolveOperationalPixKey } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { PixType } from '@/types';

const PIX_TRANSACTION_TYPES: Record<string, string> = {
  cpf: 'Pix - CPF',
  cnpj: 'Pix - CNPJ',
  email: 'Pix - Email',
  phone: 'Pix - Celular',
  random: 'Pix - Aleatória',
};

interface BatchHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionId?: string;
}

async function downloadBatch(batchId: string, filename: string | null) {
  const { data: winners, error } = await supabase
    .from('winners')
    .select('name, pix_key, pix_type, value, prize_title, prize_type, cpf, phone, status, action_id')
    .eq('batch_id', batchId);

  if (error) throw error;
  if (!winners || winners.length === 0) {
    toast.warning('Nenhum ganhador encontrado neste lote.');
    return;
  }

  const { data: actionData } = await supabase
    .from('actions')
    .select('name')
    .eq('id', winners[0].action_id)
    .single();

  const actionName = actionData?.name || 'Ação';

  const rows = winners.map((w: any) => {
    const resolved = resolveOperationalPixKey(w.pix_key, w.cpf, w.phone, w.status);
    let pixKey = '';
    let pixType: PixType = 'cpf';

    if (resolved.key && resolved.source === 'pix' && w.pix_type) {
      pixKey = resolved.key;
      pixType = w.pix_type;
    } else if (resolved.key && resolved.source === 'cpf') {
      pixKey = resolved.key;
      pixType = 'cpf';
    } else if (resolved.key && resolved.source === 'phone') {
      pixKey = resolved.key;
      pixType = 'phone';
    } else if (w.pix_key && w.pix_type) {
      pixKey = w.pix_key;
      pixType = w.pix_type;
    } else if (w.cpf) {
      pixKey = w.cpf.replace(/\D/g, '');
      pixType = 'cpf';
    } else if (w.phone) {
      pixKey = w.phone.replace(/\D/g, '');
      pixType = 'phone';
    }

    const prizeLabel = w.prize_title || w.prize_type || 'Prêmio';
    const description = `AÇÃO - ${actionName} - ${prizeLabel}`.slice(0, 240);

    return {
      'Apelido': w.name,
      'Tipo de Transação': PIX_TRANSACTION_TYPES[pixType] || 'Pix - Celular',
      'Dados de Pagamento (Número do Boleto ou Chave Pix)': pixKey,
      'Valor (R$)': w.value,
      'Categoria (Opcional)': prizeLabel,
      'Centro de Custo (Opcional)': 'Premiações Instantâneas',
      'Descrição (Opcional) (Max. 240 Caractéres)': description,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lote PIX');
  ws['!cols'] = [
    { wch: 25 }, { wch: 18 }, { wch: 50 }, { wch: 12 },
    { wch: 20 }, { wch: 25 }, { wch: 50 },
  ];

  const outputName = filename || `lote_pix_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, outputName);
}

export function BatchHistorySheet({ open, onOpenChange, actionId }: BatchHistorySheetProps) {
  const { data: batches = [], isLoading } = usePixBatches(actionId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const totalValue = batches.reduce((s, b) => s + b.totalValue, 0);
  const totalWinners = batches.reduce((s, b) => s + b.winnerCount, 0);

  const handleDownload = async (batchId: string, filename: string | null) => {
    setDownloadingId(batchId);
    try {
      await downloadBatch(batchId, filename);
      toast.success('Arquivo baixado com sucesso!');
    } catch (err) {
      console.error('Download batch error:', err);
      toast.error('Erro ao baixar arquivo do lote.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Histórico de Lotes PIX
          </SheetTitle>
          <SheetDescription>
            {batches.length} lote(s) gerado(s)
            {batches.length > 0 && (
              <> · {totalWinners} ganhadores · {formatCurrency(totalValue)}</>
            )}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : batches.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <FileSpreadsheet className="h-10 w-10 opacity-40" />
            Nenhum lote PIX gerado ainda.
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 pb-4">
              {batches.map(batch => (
                <div
                  key={batch.id}
                  className="rounded-lg border bg-card p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {batch.actionName || 'Ação'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(batch.generatedAt)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {formatCurrency(batch.totalValue)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileSpreadsheet className="h-3 w-3" />
                        {batch.winnerCount} ganhador(es)
                      </span>
                      {batch.generatedBy && (
                        <span>por {batch.generatedBy}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      disabled={downloadingId === batch.id}
                      onClick={() => handleDownload(batch.id, batch.filename)}
                    >
                      {downloadingId === batch.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      Baixar
                    </Button>
                  </div>

                  {batch.filename && (
                    <p className="text-[10px] text-muted-foreground/70 truncate">
                      {batch.filename}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}