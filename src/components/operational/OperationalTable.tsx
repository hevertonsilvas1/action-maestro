import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Eye, FileText, History, MessageSquare, Paperclip } from 'lucide-react';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';
import { formatDuration, getDurationVariant } from '@/hooks/useTimeInStatus';
import { TimeInStatusBadge } from '@/components/TimeInStatusBadge';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Winner, Action } from '@/types';

interface Props {
  winners: Winner[];
  actionsMap: Record<string, Action>;
  timeInStatus: Record<string, number>;
  warningMinutes?: number;
  criticalMinutes?: number;
  onViewDetails: (w: Winner) => void;
  onViewHistory: (w: Winner) => void;
  onViewReceipt: (w: Winner) => void;
}

export function OperationalTable({ winners, actionsMap, timeInStatus, warningMinutes = 10, criticalMinutes = 30, onViewDetails, onViewHistory, onViewReceipt }: Props) {
  const { getLabel, getColor } = useWinnerStatusMap();

  const durationVariant = (ms: number) => getDurationVariant(ms, warningMinutes, criticalMinutes);

  const durationClass = (variant: 'normal' | 'warning' | 'critical') => {
    if (variant === 'critical') return 'text-destructive font-semibold';
    if (variant === 'warning') return 'text-warning font-medium';
    return 'text-muted-foreground';
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs">Ganhador</TableHead>
            <TableHead className="text-xs hidden sm:table-cell">Telefone</TableHead>
            <TableHead className="text-xs hidden lg:table-cell">Ação</TableHead>
            <TableHead className="text-xs hidden md:table-cell">Prêmio</TableHead>
            <TableHead className="text-xs hidden md:table-cell">Valor</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs hidden lg:table-cell">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Tempo
              </span>
            </TableHead>
            <TableHead className="text-xs text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {winners.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-12 text-sm">
                Nenhum ganhador encontrado.
              </TableCell>
            </TableRow>
          )}
          {winners.map(w => {
            const tis = timeInStatus[w.id];
            const variant = tis ? durationVariant(tis) : 'normal';
            const statusColor = getColor(w.status);

            return (
              <TableRow
                key={w.id}
                className={cn(
                  variant === 'critical' && 'bg-destructive/3',
                  variant === 'warning' && 'bg-warning/3',
                )}
              >
                <TableCell className="py-2.5">
                  <p className="text-sm font-medium truncate max-w-[160px]">{w.name}</p>
                  <p className="text-[10px] text-muted-foreground sm:hidden">{w.phone || '—'}</p>
                </TableCell>
                <TableCell className="py-2.5 hidden sm:table-cell text-xs text-muted-foreground">
                  {w.phone || '—'}
                </TableCell>
                <TableCell className="py-2.5 hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[120px]">
                  {actionsMap[w.actionId]?.name || '—'}
                </TableCell>
                <TableCell className="py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                  {w.prizeTitle}
                </TableCell>
                <TableCell className="py-2.5 hidden md:table-cell text-xs font-medium">
                  {formatCurrency(w.value)}
                </TableCell>
                <TableCell className="py-2.5">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: statusColor }}
                  >
                    {getLabel(w.status)}
                  </span>
                </TableCell>
                <TableCell className={cn('py-2.5 hidden lg:table-cell text-xs', durationClass(variant))}>
                  {tis ? formatDuration(tis) : '—'}
                </TableCell>
                <TableCell className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewDetails(w)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Detalhes</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewHistory(w)}>
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Histórico</TooltipContent>
                    </Tooltip>
                    {w.receiptUrl && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewReceipt(w)}>
                            <Paperclip className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Comprovante</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
