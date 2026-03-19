import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSpreadsheet, Package } from 'lucide-react';
import { usePixBatches } from '@/hooks/usePixBatches';
import { formatCurrency, formatDateTime } from '@/lib/format';

interface BatchHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionId?: string;
}

export function BatchHistorySheet({ open, onOpenChange, actionId }: BatchHistorySheetProps) {
  const { data: batches = [], isLoading } = usePixBatches(actionId);

  const totalValue = batches.reduce((s, b) => s + b.totalValue, 0);
  const totalWinners = batches.reduce((s, b) => s + b.winnerCount, 0);

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

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileSpreadsheet className="h-3 w-3" />
                      {batch.winnerCount} ganhador(es)
                    </span>
                    {batch.generatedBy && (
                      <span>por {batch.generatedBy}</span>
                    )}
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
