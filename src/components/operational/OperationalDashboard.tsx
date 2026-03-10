import { useMemo, useState } from 'react';
import { useWinners } from '@/hooks/useWinners';
import { useActions } from '@/hooks/useActions';
import { useTimeInStatus, useLiveTimeInStatus } from '@/hooks/useTimeInStatus';
import { useStatusTimeConfig } from '@/hooks/useStatusTimeConfig';
import { OperationalSummaryCards } from './OperationalSummaryCards';
import { OperationalFilters, INITIAL_FILTERS, applyOperationalFilters, type OperationalFilterValues } from './OperationalFilters';
import { OperationalTable } from './OperationalTable';
import { OperationalBottlenecks } from './OperationalBottlenecks';
import { TablePagination } from '@/components/TablePagination';
import { StatusHistorySheet } from '@/components/StatusHistorySheet';
import { ReceiptManager } from '@/components/ReceiptManager';
import { Loader2 } from 'lucide-react';
import type { Winner } from '@/types';

export function OperationalDashboard() {
  const { data: winners = [], isLoading: winnersLoading } = useWinners();
  const { data: actions = [], isLoading: actionsLoading } = useActions();

  const [filters, setFilters] = useState<OperationalFilterValues>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [historyWinner, setHistoryWinner] = useState<Winner | null>(null);
  const [receiptWinner, setReceiptWinner] = useState<Winner | null>(null);

  const actionsMap = useMemo(() => {
    const m: Record<string, typeof actions[0]> = {};
    actions.forEach(a => { m[a.id] = a; });
    return m;
  }, [actions]);

  const filtered = useMemo(() => applyOperationalFilters(winners, filters), [winners, filters]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const winnerIds = useMemo(() => paginated.map(w => w.id), [paginated]);
  const { data: baseTimeInStatus = {} } = useTimeInStatus(winnerIds);
  const timeInStatus = useLiveTimeInStatus(baseTimeInStatus);
  const { data: timeConfig } = useStatusTimeConfig();
  const warningMin = timeConfig?.warning_minutes ?? 10;
  const criticalMin = timeConfig?.critical_minutes ?? 30;

  const isLoading = winnersLoading || actionsLoading;

  const handleStatusClick = (status: string) => {
    if (status === 'all') {
      setFilters({ ...INITIAL_FILTERS });
    } else if (status === 'error') {
      setFilters({ ...INITIAL_FILTERS, pendingType: 'error' });
    } else {
      setFilters({ ...INITIAL_FILTERS, status });
    }
    setPage(1);
  };

  const handleFiltersChange = (f: OperationalFilterValues) => {
    setFilters(f);
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <OperationalSummaryCards winners={winners} onStatusClick={handleStatusClick} />

      {/* Bottleneck Alerts */}
      <OperationalBottlenecks winners={winners} timeInStatus={timeInStatus} warningMinutes={warningMin} criticalMinutes={criticalMin} />

      {/* Filters */}
      <OperationalFilters filters={filters} onFiltersChange={handleFiltersChange} actionsMap={actionsMap} />

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length} ganhador{filtered.length !== 1 ? 'es' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <OperationalTable
        winners={paginated}
        actionsMap={actionsMap}
        timeInStatus={timeInStatus}
        warningMinutes={warningMin}
        criticalMinutes={criticalMin}
        onViewDetails={(w) => setHistoryWinner(w)}
        onViewHistory={(w) => setHistoryWinner(w)}
        onViewReceipt={(w) => setReceiptWinner(w)}
      />

      {/* Pagination */}
      <TablePagination
        page={page}
        pageSize={pageSize}
        totalItems={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />

      {/* Modals */}
      <StatusHistorySheet
        open={!!historyWinner}
        onOpenChange={(open) => !open && setHistoryWinner(null)}
        winnerId={historyWinner?.id || null}
        winnerName={historyWinner?.name || ''}
      />

      {receiptWinner && (
        <ReceiptManager
          open={!!receiptWinner}
          onOpenChange={(open) => !open && setReceiptWinner(null)}
          winner={receiptWinner}
          userName=""
          actionId={receiptWinner.actionId}
          actionName={actionsMap[receiptWinner.actionId]?.name || ''}
        />
      )}
    </div>
  );
}
