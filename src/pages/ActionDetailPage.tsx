import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAction } from '@/hooks/useActions';
import { useWinners } from '@/hooks/useWinners';
import { usePrizes } from '@/hooks/usePrizes';
import { useCosts } from '@/hooks/useCosts';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatCurrency, formatPercent, formatDate, formatPhone, formatDateTime, formatCpf, formatPixKey, resolveOperationalPixKey } from '@/lib/format';
import { formatRelativeTime, isWindowOpen } from '@/lib/time';
import { useQueryClient } from '@tanstack/react-query';
import { maskPixKey, getPixStatus } from '@/lib/pix-validation';
import { ACTION_STATUS_LABELS, ACTION_STATUS_COLORS, PIX_TYPE_LABELS, WinnerStatus } from '@/types';
import type { Action } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DollarSign, TrendingUp, Users, ArrowLeft, Trophy, Receipt,
  PlusCircle, Download, Send, FileSpreadsheet, CheckCircle2,
  Target, Loader2, Pencil, Copy, Trash2, Archive, RotateCcw, Clock,
  History, User, CalendarIcon, X, Search, FileText, AlertCircle, RefreshCw,
  CreditCard, ShieldCheck, AlertTriangle, Paperclip, MessageSquare, Info,
  XCircle, Phone, UserX,
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { useDuplicateAction } from '@/hooks/useDuplicateAction';
import { useDeleteAction, validateActionDeletion } from '@/hooks/useDeleteAction';
import { useArchiveAction, useRestoreAction } from '@/hooks/useArchiveAction';
import { DeleteActionDialog } from '@/components/DeleteActionDialog';
import { NewWinnerModal } from '@/components/NewWinnerModal';
import { DeleteWinnerDialog } from '@/components/DeleteWinnerDialog';
import { BatchStatusModal } from '@/components/BatchStatusModal';
import { PixDataModal } from '@/components/PixDataModal';
import { ReceiptManager } from '@/components/ReceiptManager';
import { BatchGeneratorModal } from '@/components/BatchGeneratorModal';
import { StatusHistorySheet } from '@/components/StatusHistorySheet';
import { TimeInStatusBadge } from '@/components/TimeInStatusBadge';
import { BulkDeleteWinnersDialog } from '@/components/BulkDeleteWinnersDialog';
import { useTimeInStatus, useLiveTimeInStatus } from '@/hooks/useTimeInStatus';
import { useStatusTimeConfig } from '@/hooks/useStatusTimeConfig';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { ImportWinnersModal } from '@/components/ImportWinnersModal';
import { RequestPixModal, getEligibleWinners } from '@/components/RequestPixModal';
import { useRequestPix } from '@/hooks/useRequestPix';
import { WinnersFilters, useWinnersFilters, applyWinnersFilters } from '@/components/WinnersFilters';
import { TablePagination, paginateArray } from '@/components/TablePagination';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Winner } from '@/types';

export default function ActionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: action, isLoading: loadingAction } = useAction(id);
  const { data: winners = [], isLoading: loadingWinners } = useWinners(id);
  const { data: prizes = [], isLoading: loadingPrizes } = usePrizes(id ?? '');
  const { data: costs = [], isLoading: loadingCosts } = useCosts(id ?? '');
  const { data: auditLog = [] } = useAuditLog(id);
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const { duplicate, isPending: isDuplicating } = useDuplicateAction();
  const { deleteAction, isPending: isDeleting } = useDeleteAction();
  const { archive, isPending: isArchiving } = useArchiveAction();
  const { restore, isPending: isRestoring } = useRestoreAction();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const queryClient = useQueryClient();
  const [deleteBlockReason, setDeleteBlockReason] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixTarget, setPixTarget] = useState<Winner | null>(null);
  const [newWinnerOpen, setNewWinnerOpen] = useState(false);
  const [deleteWinnerTarget, setDeleteWinnerTarget] = useState<Winner | null>(null);
  const [batchStatusOpen, setBatchStatusOpen] = useState(false);
  const [selectedWinnerIds, setSelectedWinnerIds] = useState<Set<string>>(new Set());
  const [receiptTarget, setReceiptTarget] = useState<Winner | null>(null);
  const [batchGeneratorOpen, setBatchGeneratorOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Winner | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { filters: winnersFilters, setFilters: setWinnersFilters } = useWinnersFilters();
  const [winnersPage, setWinnersPage] = useState(1);
  const [winnersPageSize, setWinnersPageSize] = useState(20);
  const [winnersTab, setWinnersTab] = useState<'pending' | 'completed'>('pending');
  const [auditOpFilter, setAuditOpFilter] = useState<string>('all');
  const [auditDateFrom, setAuditDateFrom] = useState<Date | undefined>();
  const [auditDateTo, setAuditDateTo] = useState<Date | undefined>();
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditUserFilter, setAuditUserFilter] = useState<string>('all');

  const filteredAuditLog = useMemo(() => {
    const searchLower = auditSearch.toLowerCase().trim();
    return auditLog.filter((entry) => {
      if (auditOpFilter !== 'all' && entry.operation !== auditOpFilter) return false;
      if (auditUserFilter !== 'all' && (entry.userName || 'Sistema') !== auditUserFilter) return false;
      const entryDate = new Date(entry.createdAt);
      if (auditDateFrom && entryDate < auditDateFrom) return false;
      if (auditDateTo) {
        const endOfDay = new Date(auditDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (entryDate > endOfDay) return false;
      }
      if (searchLower) {
        const searchable = [
          entry.userName,
          entry.operation,
          entry.tableName,
          entry.changes ? JSON.stringify(entry.changes) : '',
        ].join(' ').toLowerCase();
        if (!searchable.includes(searchLower)) return false;
      }
      return true;
    });
  }, [auditLog, auditOpFilter, auditUserFilter, auditDateFrom, auditDateTo, auditSearch]);

  const auditUsers = useMemo(() => {
    const names = new Set(auditLog.map((e) => e.userName || 'Sistema'));
    return Array.from(names).sort();
  }, [auditLog]);

  // Reset page when filters change
  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditLog.length / auditPageSize));
  const safeAuditPage = Math.min(auditPage, auditTotalPages);
  const paginatedAuditLog = filteredAuditLog.slice((safeAuditPage - 1) * auditPageSize, safeAuditPage * auditPageSize);

  const { requestPix, isPending: isRequestingPix } = useRequestPix(id ?? '', action?.name ?? '');

  const COMPLETED_STATUSES = ['paid', 'receipt_sent'];
  const completedWinnersCount = useMemo(() => winners.filter(w => COMPLETED_STATUSES.includes(w.status)).length, [winners]);
  const pendingWinnersCount = useMemo(() => winners.length - completedWinnersCount, [winners, completedWinnersCount]);

  const tabbedWinners = useMemo(() => winners.filter(w =>
    winnersTab === 'completed'
      ? COMPLETED_STATUSES.includes(w.status)
      : !COMPLETED_STATUSES.includes(w.status)
  ), [winners, winnersTab]);

  const filteredWinners = useMemo(
    () => applyWinnersFilters(tabbedWinners, winnersFilters),
    [tabbedWinners, winnersFilters]
  );

  const paginatedWinners = useMemo(
    () => paginateArray(filteredWinners, winnersPage, winnersPageSize),
    [filteredWinners, winnersPage, winnersPageSize]
  );

  // Time in status
  const winnerIds = useMemo(() => paginatedWinners.map(w => w.id), [paginatedWinners]);
  const { data: baseTimeInStatus = {} } = useTimeInStatus(winnerIds);
  const liveTimeInStatus = useLiveTimeInStatus(baseTimeInStatus);
  const { data: timeConfig } = useStatusTimeConfig();
  const warningMin = timeConfig?.warning_minutes ?? 10;
  const criticalMin = timeConfig?.critical_minutes ?? 30;

  const handleWinnersFiltersChange = useCallback((f: typeof winnersFilters) => {
    setWinnersFilters(f);
    setWinnersPage(1);
  }, [setWinnersFilters]);

  const toggleWinner = useCallback((winnerId: string) => {
    setSelectedWinnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(winnerId)) next.delete(winnerId);
      else next.add(winnerId);
      return next;
    });
  }, []);

  const toggleAllWinners = useCallback(() => {
    if (selectedWinnerIds.size === paginatedWinners.length) {
      setSelectedWinnerIds(new Set());
    } else {
      setSelectedWinnerIds(new Set(paginatedWinners.map((w) => w.id)));
    }
  }, [paginatedWinners, selectedWinnerIds.size]);

  const selectedWinners = useMemo(
    () => winners.filter((w) => selectedWinnerIds.has(w.id)),
    [winners, selectedWinnerIds]
  );

  const handleRequestPix = async () => {
    const eligible = getEligibleWinners(selectedWinners);
    if (eligible.length === 0) return;
    await requestPix(eligible);
    setPixModalOpen(false);
    setSelectedWinnerIds(new Set());
  };

  // === PLANNING LAYER ===
  const totalPlannedPrizes = prizes.reduce((s, p) => s + p.totalValue, 0);
  const totalCosts = costs.reduce((s, c) => s + c.value, 0);

  // === EXECUTION / REALIZED LAYER (derived from winners) ===
  const paidStatuses: WinnerStatus[] = ['paid', 'receipt_sent'];

  const winnersWithPaid = winners.filter((w) => paidStatuses.includes(w.status));
  const totalPaidValue = winnersWithPaid.reduce((s, w) => s + w.value, 0);
  const totalPendingValue = winners.reduce((s, w) => s + w.value, 0) - totalPaidValue;
  const receiptSentCount = winners.filter(w => w.status === 'receipt_sent').length;
  const receiptAttachedCount = winners.filter(w => w.status === 'receipt_attached' || w.status === 'receipt_sent').length;

  // Prize consumption: group winners by prize title to track planned vs processed
  const prizeConsumption = useMemo(() => {
    if (!prizes.length) return [];
    return prizes.map(prize => {
      const matchingWinners = winners.filter(w => w.prizeTitle === prize.title);
      const processedCount = matchingWinners.length;
      const paidCount = matchingWinners.filter(w => paidStatuses.includes(w.status)).length;
      const paidValue = matchingWinners.filter(w => paidStatuses.includes(w.status)).reduce((s, w) => s + w.value, 0);
      return {
        ...prize,
        processedCount,
        remainingCount: Math.max(0, prize.quantity - processedCount),
        paidCount,
        paidValue,
        pendingValue: matchingWinners.reduce((s, w) => s + w.value, 0) - paidValue,
        progress: prize.quantity > 0 ? (processedCount / prize.quantity) * 100 : 0,
      };
    });
  }, [prizes, winners]);

  const statusCounts: Record<string, number> = {};
  winners.forEach((w) => {
    statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
  });

  const paidProgress = winners.length > 0
    ? (winnersWithPaid.length / winners.length) * 100
    : 0;

  // Realized financials
  const realizedCost = totalPaidValue + totalCosts + (action?.totalTaxes || 0);
  const realizedProfit = (action?.expectedRevenue || 0) - realizedCost;

  const isLoading = loadingAction || loadingWinners || loadingPrizes || loadingCosts;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!action) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Ação não encontrada.</p>
          <Link to="/actions">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Voltar
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const isArchived = action.status === 'archived';
  const isPlanning = action.status === 'planning';
  const isOperational = !isPlanning && !isArchived;

  // Support users should not see action details page at all for financial data
  // but they can see winners pipeline. We hide financial KPIs and restrict actions.

  return (
    <AppLayout>
      <AppHeader
        title={action.name}
        subtitle={isArchived ? 'Ação arquivada (somente leitura)' : 'Detalhes da ação'}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link to={isAdmin ? "/actions" : "/"}>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Voltar
              </Button>
            </Link>
            {isAdmin && !isArchived && (
              <Link to={`/actions/${id}/edit`}>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {action.status === 'completed' ? 'Visualizar / Duplicar' : 'Editar'}
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => duplicate(id!)} disabled={isDuplicating}>
                {isDuplicating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                Duplicar Ação
              </Button>
            )}
            {isAdmin && isArchived && (
              <Button
                variant="outline" size="sm"
                className="h-8 text-xs"
                onClick={() => restore(id!)}
                disabled={isRestoring}
              >
                {isRestoring ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                Restaurar Ação
              </Button>
            )}
            {isAdmin && !isArchived && (
              <Button
                variant="outline" size="sm"
                className="h-8 text-xs"
                onClick={() => archive(id!)}
                disabled={isArchiving}
              >
                {isArchiving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Archive className="h-3.5 w-3.5 mr-1" />}
                Arquivar
              </Button>
            )}
            {isAdmin && !isArchived && (
              <Button
                variant="outline" size="sm"
                className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={async () => {
                  const validation = await validateActionDeletion(id!);
                  setDeleteBlockReason(validation.canDelete ? null : (validation.reason ?? null));
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Excluir
              </Button>
            )}
            {isAdmin && !isArchived ? (
              <Select
                value={action.status}
                onValueChange={async (newStatus) => {
                  if (newStatus === action.status) return;
                  setChangingStatus(true);
                  try {
                    const { error } = await supabase
                      .from('actions')
                      .update({ status: newStatus as any, previous_status: action.status as any })
                      .eq('id', id!);
                    if (error) throw error;
                    queryClient.invalidateQueries({ queryKey: ['actions'] });
                    queryClient.invalidateQueries({ queryKey: ['actions', id] });
                    toast.success(`Status alterado para "${ACTION_STATUS_LABELS[newStatus as Action['status']] || newStatus}"`);
                  } catch (err: any) {
                    console.error(err);
                    toast.error('Erro ao alterar status da ação.');
                  } finally {
                    setChangingStatus(false);
                  }
                }}
                disabled={changingStatus}
              >
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['planning', 'active', 'completed', 'cancelled'] as Action['status'][]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {ACTION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <StatusBadge
                status={action.status}
                labels={ACTION_STATUS_LABELS}
                colors={ACTION_STATUS_COLORS}
              />
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* KPIs - Admin only */}
        {isAdmin && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <StatsCard title="Receita Esperada" value={formatCurrency(action.expectedRevenue)} icon={DollarSign} variant="primary" subtitle={action.status === 'planning' ? 'Planejamento' : undefined} />
            <StatsCard title="Lucro Planejado" value={formatCurrency(action.grossProfit)} icon={TrendingUp} variant={action.grossProfit >= 0 ? 'success' : 'warning'} subtitle={`${formatPercent(action.marginPercent)} margem`} />
            <StatsCard title="Total Pago (Real)" value={formatCurrency(totalPaidValue)} icon={CheckCircle2} variant="accent" subtitle={`${formatCurrency(totalPendingValue)} pendente`} />
            <StatsCard title="Ganhadores" value={String(winners.length)} icon={Users} subtitle={`${winnersWithPaid.length} pagos · ${receiptSentCount} comp. enviados`} />
          </div>
        )}

        {/* Support sees only winner count KPI */}
        {!isAdmin && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <StatsCard title="Ganhadores" value={String(winners.length)} icon={Users} subtitle={`${winnersWithPaid.length} pagos`} />
            <StatsCard title="Pendentes" value={String(winners.length - winnersWithPaid.length)} icon={Clock} variant="warning" />
            <StatsCard title="Progresso" value={`${paidProgress.toFixed(0)}%`} icon={CheckCircle2} variant="success" />
          </div>
        )}

        {/* Planned vs Real - Admin only */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Planejado vs Real</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Prêmios pagos</span>
                    <span className="font-medium">{formatCurrency(totalPaidValue)} / {formatCurrency(totalPlannedPrizes)}</span>
                  </div>
                  <Progress value={totalPlannedPrizes > 0 ? (totalPaidValue / totalPlannedPrizes) * 100 : 0} className="h-2" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t">
                  <div className="text-center">
                    <p className="text-lg font-bold">{formatCurrency(action.totalCost)}</p>
                    <p className="text-[10px] text-muted-foreground">Custo Planejado</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-success">{formatCurrency(action.grossProfit)}</p>
                    <p className="text-[10px] text-muted-foreground">Lucro Planejado</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{formatCurrency(totalPaidValue)}</p>
                    <p className="text-[10px] text-muted-foreground">Já Pago</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-warning">{formatCurrency(totalPlannedPrizes - totalPaidValue)}</p>
                    <p className="text-[10px] text-muted-foreground">Falta Pagar</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Receipt className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Pipeline de Pagamento</h3>
              </div>
              {winners.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum ganhador ainda.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {Object.entries(statusCounts).map(([status, count]) => {
                      const pctOfTotal = (count / winners.length) * 100;
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <StatusBadge status={status as WinnerStatus} className="w-36 justify-center" />
                          <div className="flex-1">
                            <Progress value={pctOfTotal} className="h-1.5" />
                          </div>
                          <span className="text-xs font-semibold w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Progresso total</span>
                    <div className="flex items-center gap-2">
                      <Progress value={paidProgress} className="h-2 w-20" />
                      <span className="text-xs font-semibold">{paidProgress.toFixed(0)}%</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Support sees only pipeline */}
        {!isAdmin && winners.length > 0 && (
          <div className="rounded-xl border bg-card p-4 lg:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Pipeline de Pagamento</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(statusCounts).map(([status, count]) => {
                const pctOfTotal = (count / winners.length) * 100;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <StatusBadge status={status as WinnerStatus} className="w-36 justify-center" />
                    <div className="flex-1">
                      <Progress value={pctOfTotal} className="h-1.5" />
                    </div>
                    <span className="text-xs font-semibold w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Progresso total</span>
              <div className="flex items-center gap-2">
                <Progress value={paidProgress} className="h-2 w-20" />
                <span className="text-xs font-semibold">{paidProgress.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="winners" className="space-y-4">
          <TabsList>
            <TabsTrigger value="winners" className="text-xs">
              <Trophy className="h-3.5 w-3.5 mr-1.5" />
              Ganhadores ({winners.length})
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="prizes" className="text-xs">
                <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                Prêmios ({prizes.length})
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="costs" className="text-xs">
                <Receipt className="h-3.5 w-3.5 mr-1.5" />
                Custos ({costs.length})
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="audit" className="text-xs">
                <History className="h-3.5 w-3.5 mr-1.5" />
                Histórico ({auditLog.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="winners" className="space-y-3">
            {isPlanning && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-medium text-warning">Ação em Planejamento</p>
                  <p className="text-muted-foreground">
                    Ações em planejamento não podem receber ganhadores nem iniciar operações. Altere o status da ação para iniciar a operação.
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {isOperational && (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setNewWinnerOpen(true)}>
                    <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                    Novo Ganhador
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setImportModalOpen(true)}>
                    <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                    Importar Ganhadores
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      if (selectedWinnerIds.size === 0) {
                        toast.info('Selecione pelo menos um ganhador.');
                        return;
                      }
                      setPixModalOpen(true);
                    }}
                    disabled={isRequestingPix}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Solicitar Pix {selectedWinnerIds.size > 0 && `(${selectedWinnerIds.size})`}
                  </Button>
                  {isAdmin && selectedWinnerIds.size > 0 && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setBatchStatusOpen(true)}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Alterar Status ({selectedWinnerIds.size})
                    </Button>
                  )}
                  {isAdmin && selectedWinnerIds.size > 0 && (
                    <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => setBulkDeleteOpen(true)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Excluir ({selectedWinnerIds.size})
                    </Button>
                  )}
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setBatchGeneratorOpen(true)}>
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                      Gerar Lote PIX
                    </Button>
                  )}
                </>
              )}
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exportar
              </Button>
            </div>

            {/* Pendentes / Concluídos Tabs */}
            <Tabs value={winnersTab} onValueChange={(v) => { setWinnersTab(v as 'pending' | 'completed'); setWinnersPage(1); }}>
              <TabsList>
                <TabsTrigger value="pending" className="text-xs">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Pendentes ({pendingWinnersCount})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Concluídos ({completedWinnersCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Quick Filter Chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'pix_refused', label: 'Recusado', statusValue: 'pix_refused', icon: XCircle },
                { key: 'numero_inexistente', label: 'Nº Inexist.', statusValue: 'numero_inexistente', icon: Phone },
                { key: 'cliente_nao_responde', label: 'Não Resp.', statusValue: 'cliente_nao_responde', icon: UserX },
                { key: 'receipt_attached', label: 'Comp. Pendente', statusValue: 'receipt_attached', icon: Paperclip },
                { key: 'window_open', label: 'Janela Aberta', windowValue: 'open', icon: MessageSquare },
                { key: 'window_closed', label: 'Janela Fechada', windowValue: 'closed', icon: MessageSquare },
              ].map(qf => {
                const active = ('statusValue' in qf && qf.statusValue) ? winnersFilters.status === qf.statusValue : ('windowValue' in qf && qf.windowValue) ? winnersFilters.whatsappWindow === qf.windowValue : false;
                const QfIcon = qf.icon;
                return (
                  <button
                    key={qf.key}
                    onClick={() => {
                      if (active) {
                        handleWinnersFiltersChange({
                          ...winnersFilters,
                          ...('statusValue' in qf && qf.statusValue ? { status: 'all' } : {}),
                          ...('windowValue' in qf && qf.windowValue ? { whatsappWindow: 'all' as const } : {}),
                        });
                      } else {
                        handleWinnersFiltersChange({
                          ...winnersFilters,
                          ...('statusValue' in qf && qf.statusValue ? { status: qf.statusValue } : {}),
                          ...('windowValue' in qf && qf.windowValue ? { whatsappWindow: qf.windowValue as 'open' | 'closed' } : {}),
                        });
                      }
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted',
                    )}
                  >
                    <QfIcon className="h-3 w-3" />
                    {qf.label}
                  </button>
                );
              })}
            </div>

            <WinnersFilters
              filters={winnersFilters}
              onFiltersChange={handleWinnersFiltersChange}
              showValueFilter={isAdmin}
            />

            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-3 w-10">
                        <Checkbox
                          checked={paginatedWinners.length > 0 && paginatedWinners.every((w) => selectedWinnerIds.has(w.id))}
                          onCheckedChange={toggleAllWinners}
                          aria-label="Selecionar todos"
                        />
                      </th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Nome</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Telefone</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">CPF</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Prêmio</th>
                      {isAdmin && <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Valor</th>}
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Chave PIX</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Tipo do PIX</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Data/Hora Premiação</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Status</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Janela</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Tempo</span>
                      </th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedWinners.length === 0 ? (
                      <tr><td colSpan={isAdmin ? 14 : 13} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum ganhador encontrado.</td></tr>
                    ) : (
                      paginatedWinners.map((w, i) => {
                        const windowOpen = isWindowOpen(w.lastInboundAt);
                        const canRequestPix = ['imported', 'pix_refused'].includes(w.status);
                        const opPix = resolveOperationalPixKey(w.pixKey, w.cpf, w.phone, w.status);
                        return (
                          <tr
                            key={w.id}
                            className={cn(
                              "border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in",
                              selectedWinnerIds.has(w.id) && "bg-primary/5"
                            )}
                            style={{ animationDelay: `${i * 20}ms` }}
                          >
                            <td className="px-3 py-2.5">
                              <Checkbox checked={selectedWinnerIds.has(w.id)} onCheckedChange={() => toggleWinner(w.id)} />
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="text-sm font-medium">{w.name}</p>
                              {w.fullName && w.fullName !== w.name && <p className="text-[10px] text-muted-foreground">{w.fullName}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                              {formatPhone(w.phone)}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                              {formatCpf(w.cpf)}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{w.prizeTitle}</td>
                            {isAdmin && <td className="px-3 py-2.5 text-right text-sm font-medium">{formatCurrency(w.value)}</td>}
                            <td className="px-3 py-2.5 text-xs font-mono">
                              {opPix.key ? (
                                <span className={cn(
                                  opPix.source === 'pix' ? 'text-muted-foreground' : 'text-warning',
                                )}>
                                  {opPix.key}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">
                              {opPix.source === 'pix' && w.pixType ? PIX_TYPE_LABELS[w.pixType] : opPix.source === 'cpf' ? 'CPF' : opPix.source === 'phone' ? 'Telefone' : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(w.prizeDatetime)}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <StatusBadge status={w.status} className="text-[11px]" />
                            </td>
                            {/* Window */}
                            <td className="px-3 py-2.5 text-center">
                              {w.ultimaInteracaoWhatsapp ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[9px] px-1.5 py-0',
                                      windowOpen
                                        ? 'bg-success/15 text-success border-success/30'
                                        : 'bg-destructive/15 text-destructive border-destructive/30',
                                    )}
                                  >
                                    <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                                    {windowOpen ? 'Aberta' : 'Fechada'}
                                  </Badge>
                                  <span className="text-[9px] text-muted-foreground">
                                    {formatRelativeTime(w.ultimaInteracaoWhatsapp)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </td>
                            {/* Time in Status */}
                            <td className="px-3 py-2.5 text-center">
                              <TimeInStatusBadge
                                ms={liveTimeInStatus[w.id]}
                                status={w.status}
                                warningMinutes={warningMin}
                                criticalMinutes={criticalMin}
                              />
                            </td>
                            {/* Actions */}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                {canRequestPix && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setSelectedWinnerIds(new Set([w.id])); setPixModalOpen(true); }}>
                                        <Send className="h-4 w-4 text-info" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Solicitar Pix</TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setPixTarget(w); }}>
                                      <CreditCard className={cn('h-4 w-4', w.pixKey ? 'text-purple' : 'text-muted-foreground')} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{w.pixKey ? 'Editar Pix' : 'Cadastrar Pix'}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setReceiptTarget(w); }}>
                                      <Paperclip className={cn('h-4 w-4', w.receiptUrl ? 'text-success' : 'text-muted-foreground')} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{w.receiptUrl ? 'Gerenciar Comprovante' : 'Anexar Comprovante'}</TooltipContent>
                                </Tooltip>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors">
                                      <Info className={cn('h-4 w-4', w.lastPixError ? 'text-destructive' : 'text-muted-foreground')} />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent side="left" className="w-80 text-xs space-y-2">
                                    <p className="font-semibold text-sm">Debug — Rastreio</p>
                                    <div className="space-y-1.5">
                                      <div className="flex justify-between"><span className="text-muted-foreground">Winner ID:</span><span className="font-mono text-[10px] select-all">{w.id.slice(0, 8)}…</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Phone E164:</span><span className="font-mono text-[10px]">{w.phoneE164 || '—'}</span></div>
                                      <hr className="border-border" />
                                      <div className="flex justify-between"><span className="text-muted-foreground">Último outbound:</span><span className="font-mono">{w.lastOutboundAt ? formatRelativeTime(w.lastOutboundAt) : '—'}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Último inbound:</span><span className="font-mono">{w.lastInboundAt ? formatRelativeTime(w.lastInboundAt) : (w.ultimaInteracaoWhatsapp ? formatRelativeTime(w.ultimaInteracaoWhatsapp) : '—')}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Última solicitação:</span><span className="font-mono">{w.lastPixRequestAt ? formatRelativeTime(w.lastPixRequestAt) : '—'}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Solicitado por:</span><span>{w.lastPixRequestedBy || '—'}</span></div>
                                      {w.lastPixError && (
                                        <div className="mt-1 p-2 rounded bg-destructive/10 text-destructive">
                                          <span className="font-medium">Erro: </span>{w.lastPixError}
                                        </div>
                                      )}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setHistoryTarget(w); }}>
                                      <History className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Histórico</TooltipContent>
                                </Tooltip>
                                {isAdmin && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteWinnerTarget(w); }}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Excluir</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {paginatedWinners.map((w, i) => {
                const windowOpen = isWindowOpen(w.lastInboundAt);
                const canRequestPix = ['imported', 'pix_refused'].includes(w.status);
                return (
                  <div
                    key={w.id}
                    className={cn(
                      'rounded-xl border bg-card p-4 animate-fade-in transition-all',
                      selectedWinnerIds.has(w.id) && 'ring-2 ring-primary',
                    )}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Checkbox checked={selectedWinnerIds.has(w.id)} onCheckedChange={() => toggleWinner(w.id)} className="mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{w.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{formatPhone(w.phone)}</p>
                        </div>
                      </div>
                      <StatusBadge status={w.status} className="text-xs px-3 py-1 shrink-0" />
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate mr-2">{w.prizeTitle}</span>
                        <span className="font-semibold shrink-0">{formatCurrency(w.value)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <TimeInStatusBadge ms={liveTimeInStatus[w.id]} status={w.status} warningMinutes={warningMin} criticalMinutes={criticalMin} />
                        {w.ultimaInteracaoWhatsapp && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-2 py-0.5 shrink-0',
                              windowOpen ? 'bg-success/15 text-success border-success/30' : 'bg-destructive/15 text-destructive border-destructive/30',
                            )}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {windowOpen ? 'Aberta' : 'Fechada'} · {formatRelativeTime(w.ultimaInteracaoWhatsapp)}
                          </Badge>
                        )}
                      </div>
                      {w.lastPixError && (
                        <div className="flex items-center gap-1 text-[11px] text-destructive">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span className="truncate">{w.lastPixError}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-3 border-t">
                      {canRequestPix && (
                        <Button variant="outline" size="sm" className="h-10 flex-1 text-xs" onClick={e => { e.stopPropagation(); setSelectedWinnerIds(new Set([w.id])); setPixModalOpen(true); }}>
                          <Send className="h-4 w-4 mr-1.5 text-info" />
                          Pix
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-10 flex-1 text-xs" onClick={e => { e.stopPropagation(); setPixTarget(w); }}>
                        <CreditCard className={cn('h-4 w-4 mr-1.5', w.pixKey ? 'text-purple' : '')} />
                        Dados
                      </Button>
                      <Button variant="outline" size="sm" className="h-10 flex-1 text-xs" onClick={e => { e.stopPropagation(); setReceiptTarget(w); }}>
                        <Paperclip className={cn('h-4 w-4 mr-1.5', w.receiptUrl ? 'text-success' : '')} />
                        Comp.
                      </Button>
                      {isAdmin && (
                        <Button variant="outline" size="sm" className="h-10 text-xs text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteWinnerTarget(w); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <TablePagination
              page={winnersPage}
              pageSize={winnersPageSize}
              totalItems={filteredWinners.length}
              onPageChange={setWinnersPage}
              onPageSizeChange={setWinnersPageSize}
            />
          </TabsContent>

          <TabsContent value="prizes" className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Planejado: <span className="font-semibold text-foreground">{formatCurrency(totalPlannedPrizes)}</span></span>
                <span>Pago: <span className="font-semibold text-success">{formatCurrency(totalPaidValue)}</span></span>
                <span>Pendente: <span className="font-semibold text-warning">{formatCurrency(totalPlannedPrizes - totalPaidValue)}</span></span>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Adicionar Prêmio
              </Button>
            </div>
            {prizes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum prêmio cadastrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prizeConsumption.map((p, i) => (
                  <div
                    key={p.id}
                    className="rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-card-hover animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold">{p.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{p.type.replace('_', ' ')}</p>
                      </div>
                      <p className="text-sm font-bold">{formatCurrency(p.totalValue)}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Processados</span>
                        <span className="font-medium">{p.processedCount} / {p.quantity}</span>
                      </div>
                      <Progress value={p.progress} className="h-1.5" />
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pt-1">
                        <div>
                          <p className="font-semibold text-foreground">{p.processedCount}</p>
                          <p>Processados</p>
                        </div>
                        <div>
                          <p className="font-semibold text-success">{p.paidCount}</p>
                          <p>Pagos</p>
                        </div>
                        <div>
                          <p className="font-semibold text-warning">{p.remainingCount}</p>
                          <p>Restantes</p>
                        </div>
                      </div>
                      <div className="flex gap-4 text-[10px] text-muted-foreground pt-1 border-t">
                        <span>Pago: {formatCurrency(p.paidValue)}</span>
                        <span>Pendente: {formatCurrency(p.pendingValue)}</span>
                        <span>{formatCurrency(p.unitValue)}/un</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="costs" className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Total custos: <span className="font-semibold text-foreground">{formatCurrency(totalCosts)}</span>
              </p>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Adicionar Custo
              </Button>
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Descrição</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Categoria</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum custo registrado.</td></tr>
                  ) : (
                    costs.map((c, i) => (
                      <tr
                        key={c.id}
                        className="border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="px-4 py-3 text-sm">{c.description}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize bg-muted px-2 py-0.5 rounded-full">
                            {c.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(c.value)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="audit" className="space-y-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Histórico de Auditoria</h3>
                  </div>
                  {auditLog.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const opLabels: Record<string, string> = {
                            create: 'Criação', update: 'Atualização', delete: 'Exclusão',
                            archive: 'Arquivamento', restore: 'Restauração', duplicate: 'Duplicação',
                          };
                          const tableLabels: Record<string, string> = {
                            actions: 'Ação', prizes: 'Premiações', costs: 'Custos',
                          };
                          const roleLabels: Record<string, string> = { admin: 'Admin', support: 'Suporte' };

                          const header = 'Data/Hora;Usuário;Role;Operação;Tabela;Alterações';
                          const rows = filteredAuditLog.map((entry) => {
                            const date = new Date(entry.createdAt).toLocaleString('pt-BR');
                            const user = entry.userName || 'Sistema';
                            const role = entry.userRole ? (roleLabels[entry.userRole] || entry.userRole) : '';
                            const op = opLabels[entry.operation] || entry.operation;
                            const table = tableLabels[entry.tableName] || entry.tableName;
                            let changesStr = '';
                            if (entry.changes) {
                              changesStr = Object.entries(entry.changes).map(([key, val]) => {
                                if (val && typeof val === 'object' && 'before' in val && 'after' in val) {
                                  return `${key}: ${val.before} → ${val.after}`;
                                }
                                if (Array.isArray(val)) return `${key}: ${val.join(', ')}`;
                                return `${key}: ${val}`;
                              }).join(' | ');
                            }
                            return `${date};${user};${role};${op};${table};"${changesStr}"`;
                          });

                          const csv = '\uFEFF' + [header, ...rows].join('\n');
                          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `auditoria-${action.name.replace(/\s+/g, '_')}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={async () => {
                          const { default: jsPDF } = await import('jspdf');
                          const { autoTable } = await import('jspdf-autotable');

                          const opLabels: Record<string, string> = {
                            create: 'Criação', update: 'Atualização', delete: 'Exclusão',
                            archive: 'Arquivamento', restore: 'Restauração', duplicate: 'Duplicação',
                          };
                          const tableLabels: Record<string, string> = {
                            actions: 'Ação', prizes: 'Premiações', costs: 'Custos',
                          };
                          const roleLabels: Record<string, string> = { admin: 'Admin', support: 'Suporte' };

                          const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

                          // Title
                          doc.setFontSize(16);
                          doc.text(`Histórico de Auditoria`, 14, 15);
                          doc.setFontSize(10);
                          doc.setTextColor(100);
                          doc.text(`Ação: ${action.name}`, 14, 22);
                          doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 27);
                          doc.text(`${filteredAuditLog.length} registro(s)`, 14, 32);
                          doc.setTextColor(0);

                          const tableRows = filteredAuditLog.map((entry) => {
                            const date = new Date(entry.createdAt).toLocaleString('pt-BR');
                            const user = entry.userName || 'Sistema';
                            const role = entry.userRole ? (roleLabels[entry.userRole] || entry.userRole) : '';
                            const op = opLabels[entry.operation] || entry.operation;
                            const table = tableLabels[entry.tableName] || entry.tableName;
                            let changesStr = '';
                            if (entry.changes) {
                              changesStr = Object.entries(entry.changes).map(([key, val]) => {
                                if (val && typeof val === 'object' && 'before' in val && 'after' in val) {
                                  return `${key}: ${val.before} → ${val.after}`;
                                }
                                if (Array.isArray(val)) return `${key}: ${val.join(', ')}`;
                                return `${key}: ${val}`;
                              }).join('\n');
                            }
                            return [date, `${user}\n${role}`, op, table, changesStr];
                          });

                          autoTable(doc, {
                            startY: 36,
                            head: [['Data/Hora', 'Usuário', 'Operação', 'Tabela', 'Alterações']],
                            body: tableRows,
                            styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                            headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
                            alternateRowStyles: { fillColor: [245, 247, 250] },
                            columnStyles: {
                              0: { cellWidth: 35 },
                              1: { cellWidth: 35 },
                              2: { cellWidth: 25 },
                              3: { cellWidth: 22 },
                              4: { cellWidth: 'auto' },
                            },
                            margin: { left: 14, right: 14, bottom: 22 },
                            didDrawPage: (data: { pageNumber: number }) => {
                              const pageCount = (doc as any).internal.getNumberOfPages();
                              const pageHeight = doc.internal.pageSize.getHeight();
                              const pageWidth = doc.internal.pageSize.getWidth();
                              doc.setFontSize(7);
                              doc.setTextColor(130, 130, 130);
                              doc.text('ActionPay — Sistema de Gestão de Ações Promocionais', 14, pageHeight - 8);
                              doc.text(`Página ${data.pageNumber} de ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
                              doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
                            },
                          });

                          doc.save(`auditoria-${action.name.replace(/\s+/g, '_')}.pdf`);
                        }}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        PDF
                      </Button>
                    </div>
                  )}
                </div>

                {/* Filters */}
                {auditLog.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b">
                    <Select value={auditOpFilter} onValueChange={setAuditOpFilter}>
                      <SelectTrigger className="h-7 w-[160px] text-xs">
                        <SelectValue placeholder="Operação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas operações</SelectItem>
                        <SelectItem value="create">Criação</SelectItem>
                        <SelectItem value="update">Atualização</SelectItem>
                        <SelectItem value="delete">Exclusão</SelectItem>
                        <SelectItem value="archive">Arquivamento</SelectItem>
                        <SelectItem value="restore">Restauração</SelectItem>
                        <SelectItem value="duplicate">Duplicação</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={auditUserFilter} onValueChange={setAuditUserFilter}>
                      <SelectTrigger className="h-7 w-[160px] text-xs">
                        <User className="h-3 w-3 mr-1" />
                        <SelectValue placeholder="Usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos usuários</SelectItem>
                        {auditUsers.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-7 text-xs w-[140px] justify-start", !auditDateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {auditDateFrom ? format(auditDateFrom, 'dd/MM/yyyy') : 'De'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={auditDateFrom} onSelect={setAuditDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-7 text-xs w-[140px] justify-start", !auditDateTo && "text-muted-foreground")}>
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {auditDateTo ? format(auditDateTo, 'dd/MM/yyyy') : 'Até'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={auditDateTo} onSelect={setAuditDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>

                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        placeholder="Buscar alterações..."
                        value={auditSearch}
                        onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                        className="h-7 text-xs pl-7 w-[180px]"
                      />
                    </div>

                    {(auditOpFilter !== 'all' || auditUserFilter !== 'all' || auditDateFrom || auditDateTo || auditSearch) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => { setAuditOpFilter('all'); setAuditUserFilter('all'); setAuditDateFrom(undefined); setAuditDateTo(undefined); setAuditSearch(''); setAuditPage(1); }}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Limpar
                      </Button>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                      <Select value={String(auditPageSize)} onValueChange={(v) => { setAuditPageSize(Number(v)); setAuditPage(1); }}>
                        <SelectTrigger className="h-7 w-[80px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-[10px] text-muted-foreground">
                        {filteredAuditLog.length} de {auditLog.length} registros
                      </span>
                    </div>
                  </div>
                )}

                {filteredAuditLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {auditLog.length === 0 ? 'Nenhum registro de auditoria.' : 'Nenhum registro encontrado com os filtros selecionados.'}
                  </p>
                ) : (
                  <>
                  <div className="space-y-3">
                     {paginatedAuditLog.map((entry) => {
                      const highlightMatch = (text: string) => {
                        const q = auditSearch.trim();
                        if (!q) return text;
                        const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                        const parts = text.split(regex);
                        if (parts.length <= 1) return text;
                        return parts.map((part, i) =>
                          regex.test(part)
                            ? <mark key={i} className="bg-yellow-300/60 dark:bg-yellow-500/40 rounded-sm px-0.5">{part}</mark>
                            : part
                        );
                      };
                      const opLabels: Record<string, string> = {
                        create: 'Criação',
                        update: 'Atualização',
                        delete: 'Exclusão',
                        archive: 'Arquivamento',
                        restore: 'Restauração',
                        duplicate: 'Duplicação',
                      };
                      const tableLabels: Record<string, string> = {
                        actions: 'Ação',
                        prizes: 'Premiações',
                        costs: 'Custos',
                      };
                      const roleLabels: Record<string, string> = { admin: 'Admin', support: 'Suporte' };

                      return (
                        <div key={entry.id} className="p-3 rounded-lg border bg-muted/30 text-xs space-y-2">
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-[10px]">
                                {highlightMatch(opLabels[entry.operation] || entry.operation)}
                              </span>
                              <span className="text-muted-foreground">
                                {highlightMatch(tableLabels[entry.tableName] || entry.tableName)}
                              </span>
                            </div>
                            <span className="text-muted-foreground text-[10px]">
                              {new Date(entry.createdAt).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="font-medium text-foreground">{highlightMatch(entry.userName || 'Sistema')}</span>
                            {entry.userRole && (
                              <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px]">
                                {roleLabels[entry.userRole] || entry.userRole}
                              </span>
                            )}
                          </div>
                          {entry.changes && Object.keys(entry.changes).length > 0 && (() => {
                            const monetaryKeys = new Set([
                              'Valor Cota', 'Receita Esperada', 'Lucro Bruto', 'Total Prêmios',
                              'Total Operacional', 'Total Impostos', 'Custo Total', 'Real Pago',
                              'Valor Unitário', 'Valor Total', 'Valor', 'value', 'unit_value',
                              'total_value', 'expected_revenue', 'gross_profit', 'total_cost',
                              'total_prizes', 'total_operational', 'total_taxes', 'real_paid',
                              'quota_value',
                            ]);
                            const fmtVal = (key: string, v: unknown) => {
                              if (v === null || v === undefined) return '—';
                              if (monetaryKeys.has(key) && typeof v === 'number') return formatCurrency(v);
                              return String(v);
                            };
                            return (
                              <div className="space-y-1 pt-1 border-t border-border/50">
                                {Object.entries(entry.changes).map(([key, val]) => {
                                  if (val && typeof val === 'object' && 'before' in val && 'after' in val) {
                                    return (
                                      <div key={key} className="flex flex-wrap gap-1.5 items-baseline">
                                        <span className="text-muted-foreground font-medium min-w-[120px]">{key}:</span>
                                      <span className="text-destructive line-through">{highlightMatch(fmtVal(key, val.before))}</span>
                                        <span className="text-muted-foreground">→</span>
                                        <span className="text-success font-medium">{highlightMatch(fmtVal(key, val.after))}</span>
                                      </div>
                                    );
                                  }
                                  if (Array.isArray(val)) {
                                    return (
                                      <div key={key}>
                                        <span className="text-muted-foreground font-medium">{key}:</span>
                                        <ul className="ml-4 list-disc">
                                          {val.map((item, idx) => <li key={idx}>{highlightMatch(String(item))}</li>)}
                                        </ul>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={key} className="flex gap-1.5">
                                      <span className="text-muted-foreground font-medium">{key}:</span>
                                      <span>{highlightMatch(fmtVal(key, val))}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {auditTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-[10px] text-muted-foreground">
                        Página {safeAuditPage} de {auditTotalPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2"
                          disabled={safeAuditPage <= 1}
                          onClick={() => setAuditPage(safeAuditPage - 1)}
                        >
                          Anterior
                        </Button>
                        {Array.from({ length: auditTotalPages }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === auditTotalPages || Math.abs(p - safeAuditPage) <= 1)
                          .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                            acc.push(p);
                            return acc;
                          }, [])
                          .map((item, idx) =>
                            item === 'ellipsis' ? (
                              <span key={`e-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                            ) : (
                              <Button
                                key={item}
                                variant={item === safeAuditPage ? 'default' : 'outline'}
                                size="sm"
                                className="h-7 w-7 text-xs p-0"
                                onClick={() => setAuditPage(item)}
                              >
                                {item}
                              </Button>
                            )
                          )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2"
                          disabled={safeAuditPage >= auditTotalPages}
                          onClick={() => setAuditPage(safeAuditPage + 1)}
                        >
                          Próximo
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {action && (
        <DeleteActionDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          actionName={action.name}
          blockReason={deleteBlockReason}
          isPending={isDeleting}
          onConfirm={async () => {
            await deleteAction(id!);
            navigate('/actions');
          }}
        />
      )}

      {action && (
        <ImportWinnersModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          actionId={action.id}
          actionName={action.name}
        />
      )}

      {action && (
        <RequestPixModal
          open={pixModalOpen}
          onOpenChange={setPixModalOpen}
          winners={selectedWinners}
          onConfirm={handleRequestPix}
          isPending={isRequestingPix}
          isAdmin={isAdmin}
        />
      )}

      {action && (
        <NewWinnerModal
          open={newWinnerOpen}
          onOpenChange={setNewWinnerOpen}
          defaultActionId={action.id}
          actionsMap={{ [action.id]: action.name }}
        />
      )}

      <DeleteWinnerDialog
        open={!!deleteWinnerTarget}
        onOpenChange={(v) => { if (!v) setDeleteWinnerTarget(null); }}
        winner={deleteWinnerTarget}
        actionName={action?.name || ''}
      />

      <BatchStatusModal
        open={batchStatusOpen}
        onOpenChange={setBatchStatusOpen}
        winnerIds={Array.from(selectedWinnerIds)}
        currentStatuses={selectedWinners.map(w => w.status)}
        onDone={() => setSelectedWinnerIds(new Set())}
      />

      <BulkDeleteWinnersDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        winners={selectedWinners}
        actionsMap={action ? { [action.id]: action.name } : {}}
        onDone={() => setSelectedWinnerIds(new Set())}
      />

      {action && (
        <PixDataModal
          open={!!pixTarget}
          onOpenChange={(v) => { if (!v) setPixTarget(null); }}
          winner={pixTarget}
          isAdmin={isAdmin}
          userName={user?.user_metadata?.display_name || user?.email || 'Sistema'}
          actionId={action.id}
        />
      )}

      {action && (
        <ReceiptManager
          open={!!receiptTarget}
          onOpenChange={(v) => { if (!v) setReceiptTarget(null); }}
          winner={receiptTarget}
          userName={user?.user_metadata?.display_name || user?.email || 'Sistema'}
          actionId={action.id}
          actionName={action.name}
        />
      )}

      {action && (
        <BatchGeneratorModal
          open={batchGeneratorOpen}
          onOpenChange={setBatchGeneratorOpen}
          winners={winners}
          actionId={action.id}
          actionName={action.name}
          userName={user?.user_metadata?.display_name || user?.email || 'Sistema'}
        />
      )}

      <StatusHistorySheet open={!!historyTarget} onOpenChange={v => { if (!v) setHistoryTarget(null); }} winnerId={historyTarget?.id || null} winnerName={historyTarget?.name || ''} />
    </AppLayout>
  );
}
