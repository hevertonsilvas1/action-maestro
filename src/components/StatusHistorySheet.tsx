import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Zap, Hand, ArrowRight, User, Tag } from 'lucide-react';
import { useStatusHistory } from '@/hooks/useStatusHistory';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';
import { Loader2 } from 'lucide-react';

interface StatusHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winnerId: string | null;
  winnerName: string;
}

export function StatusHistorySheet({ open, onOpenChange, winnerId, winnerName }: StatusHistorySheetProps) {
  const { data: history, isLoading } = useStatusHistory(open ? winnerId : null);
  const { byId } = useWinnerStatusMap();

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const TRIGGER_LABELS: Record<string, string> = {
    winner_created: 'Ganhador criado',
    pix_request_sent: 'Solicitação PIX enviada',
    pix_key_received: 'Chave PIX recebida',
    payment_registered: 'Pagamento registrado',
    receipt_attached: 'Comprovante anexado',
    receipt_sent: 'Comprovante enviado',
    manual_review_required: 'Análise manual',
    process_completed: 'Processo finalizado',
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico de Status
          </SheetTitle>
          <SheetDescription>
            Linha do tempo de <strong>{winnerName}</strong>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-2">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {!isLoading && (!history || history.length === 0) && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum histórico registrado.
            </div>
          )}

          {!isLoading && history && history.length > 0 && (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-0">
                {history.map((entry, idx) => {
                  const fromStatus = entry.from_status_id ? byId[entry.from_status_id] : null;
                  const toStatus = byId[entry.to_status_id];
                  const isAutomatic = entry.change_type === 'automatic';
                  const isFirst = idx === 0;

                  return (
                    <div key={entry.id} className="relative pl-10 pb-6">
                      {/* Timeline dot */}
                      <div
                        className="absolute left-[8px] top-1 h-[15px] w-[15px] rounded-full border-2 border-background"
                        style={{
                          backgroundColor: toStatus?.color || '#6b7280',
                        }}
                      />

                      <div className={`rounded-lg border p-3 space-y-2 ${isFirst ? 'bg-accent/30 border-primary/20' : 'bg-card'}`}>
                        {/* Status transition */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {fromStatus ? (
                            <>
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: fromStatus.color }}
                              >
                                {fromStatus.name}
                              </span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground mr-1">Início</span>
                          )}
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: toStatus?.color || '#6b7280' }}
                          >
                            {toStatus?.name || 'Desconhecido'}
                          </span>
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(entry.created_at)} {formatTime(entry.created_at)}
                          </span>

                          <span className="flex items-center gap-1">
                            {isAutomatic ? (
                              <><Zap className="h-3 w-3 text-amber-500" /> Automático</>
                            ) : (
                              <><Hand className="h-3 w-3 text-blue-500" /> Manual</>
                            )}
                          </span>

                          {entry.trigger_event && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {TRIGGER_LABELS[entry.trigger_event] || entry.trigger_event}
                            </span>
                          )}
                        </div>

                        {/* User */}
                        {entry.changed_by_name && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <User className="h-3 w-3" />
                            {entry.changed_by_name}
                          </div>
                        )}

                        {/* Notes */}
                        {entry.notes && (
                          <p className="text-[11px] text-muted-foreground italic border-t pt-1.5 mt-1">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
