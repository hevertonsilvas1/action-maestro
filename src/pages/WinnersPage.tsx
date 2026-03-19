import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { useWinners } from '@/hooks/useWinners';
import { useActions } from '@/hooks/useActions';
import { formatCurrency, formatPhone, formatDateTime, formatCpf, formatPixKey, resolveOperationalPixKey } from '@/lib/format';
import { formatRelativeTime, isWindowOpen } from '@/lib/time';
import { formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { TimeInStatusBadge } from '@/components/TimeInStatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RequestPixModal, getEligibleWinners } from '@/components/RequestPixModal';
import { useRequestPixBatch } from '@/hooks/useRequestPixBatch';
import { WinnersFilters, useWinnersFilters, applyWinnersFilters } from '@/components/WinnersFilters';
import { TablePagination, paginateArray } from '@/components/TablePagination';
import { NewWinnerModal } from '@/components/NewWinnerModal';
import { DeleteWinnerDialog } from '@/components/DeleteWinnerDialog';
import { BulkDeleteWinnersDialog } from '@/components/BulkDeleteWinnersDialog';
import { BatchStatusModal } from '@/components/BatchStatusModal';
import { PixDataModal } from '@/components/PixDataModal';
import { ReceiptManager } from '@/components/ReceiptManager';
import { BatchGeneratorModal } from '@/components/BatchGeneratorModal';
import { StatusHistorySheet } from '@/components/StatusHistorySheet';
import { BatchHistorySheet } from '@/components/BatchHistorySheet';
import { ImportWinnersModal } from '@/components/ImportWinnersModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTimeInStatus, useLiveTimeInStatus } from '@/hooks/useTimeInStatus';
import { useStatusTimeConfig } from '@/hooks/useStatusTimeConfig';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Download, Loader2, Send, PlusCircle, Trash2, AlertCircle, Info,
  RefreshCw, CreditCard, Paperclip, FileSpreadsheet, MessageSquare,
  History, Clock, Filter,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';
import { useQuickFilters } from '@/hooks/useQuickFilters';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { Winner } from '@/types';
import { PIX_TYPE_LABELS } from '@/types';
import { CheckCircle2 } from 'lucide-react';

const WINDOW_FILTERS_MAP: Record<string, { label: string; windowValue: 'open' | 'closed' }> = {
  open: { label: 'Janela Aberta', windowValue: 'open' },
  closed: { label: 'Janela Fechada', windowValue: 'closed' },
};

const COMPLETED_STATUSES = ['paid', 'receipt_sent'];

export default function WinnersPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixTarget, setPixTarget] = useState<Winner | null>(null);
  const [newWinnerOpen, setNewWinnerOpen] = useState(false);
  const [deleteWinner, setDeleteWinner] = useState<Winner | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<Winner | null>(null);
  const [batchStatusOpen, setBatchStatusOpen] = useState(false);
  const [batchGeneratorOpen, setBatchGeneratorOpen] = useState(false);
  const [batchHistoryOpen, setBatchHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Winner | null>(null);
  const [importActionSelectorOpen, setImportActionSelectorOpen] = useState(false);
  const [importActionId, setImportActionId] = useState<string>('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [winnersTab, setWinnersTab] = useState<'pending' | 'completed'>('pending');
  const { filters, setFilters } = useWinnersFilters();
  const { can } = usePermissions();
  const { activeOrdered } = useWinnerStatusMap();
  const { filters: quickFilterConfig, isLoading: quickFiltersLoading } = useQuickFilters();
  const { user } = useAuth();
  const { data: winners = [], isLoading: loadingWinners } = useWinners();
  const { data: actions = [], isLoading: loadingActions } = useActions();
  const [searchParams, setSearchParams] = useSearchParams();

  const isLoading = loadingWinners || loadingActions;

  // Read URL params on mount (from dashboard clicks)
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const urlWindow = searchParams.get('whatsappWindow');
    if (urlStatus || urlWindow) {
      setFilters(prev => ({
        ...prev,
        ...(urlStatus ? { status: urlStatus } : {}),
        ...(urlWindow ? { whatsappWindow: urlWindow as 'all' | 'open' | 'closed' } : {}),
      }));
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // All actions map (for display/filters)
  const actionsMap = useMemo(() => {
    const map: Record<string, string> = {};
    actions.forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [actions]);

  // Operational actions only (exclude planning) — for NewWinnerModal and other operational flows
  const operationalActionsMap = useMemo(() => {
    const map: Record<string, string> = {};
    actions.filter((a) => a.status !== 'planning').forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [actions]);

  const { requestPix, isPending } = useRequestPixBatch(actionsMap);

  const completedCount = useMemo(() => winners.filter(w => COMPLETED_STATUSES.includes(w.status)).length, [winners]);
  const pendingCount = useMemo(() => winners.length - completedCount, [winners, completedCount]);

  const allWinners = useMemo(() => winners
    .filter(w => winnersTab === 'completed'
      ? COMPLETED_STATUSES.includes(w.status)
      : !COMPLETED_STATUSES.includes(w.status))
    .map((w) => ({
      ...w,
      actionName: actionsMap[w.actionId] ?? '',
    })), [winners, actionsMap, winnersTab]);

  const filtered = useMemo(
    () => applyWinnersFilters(allWinners, filters),
    [allWinners, filters],
  );

  const paginated = useMemo(
    () => paginateArray(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  // Time in status
  const winnerIds = useMemo(() => paginated.map(w => w.id), [paginated]);
  const { data: baseTimeInStatus = {} } = useTimeInStatus(winnerIds);
  const liveTimeInStatus = useLiveTimeInStatus(baseTimeInStatus);
  const { data: timeConfig } = useStatusTimeConfig();
  const warningMin = timeConfig?.warning_minutes ?? 10;
  const criticalMin = timeConfig?.critical_minutes ?? 30;

  const handleFiltersChange = useCallback((f: typeof filters) => {
    setFilters(f);
    setPage(1);
  }, [setFilters]);

  const toggleWinner = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(prev =>
      prev.size === paginated.length ? new Set() : new Set(paginated.map(w => w.id)),
    );
  }, [paginated]);

  const selectedWinners = useMemo(
    () => winners.filter(w => selected.has(w.id)),
    [winners, selected],
  );

  const handleRequestPix = async () => {
    const eligible = getEligibleWinners(selectedWinners);
    if (eligible.length === 0) return;
    await requestPix(eligible);
    setPixModalOpen(false);
    setSelected(new Set());
  };

  const handleSingleRequestPix = (w: Winner) => {
    setSelected(new Set([w.id]));
    setPixModalOpen(true);
  };

  // Status counts for queue chips
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    winners.forEach(w => { counts[w.status] = (counts[w.status] || 0) + 1; });
    return counts;
  }, [winners]);

  const toggleStatusChip = useCallback((slug: string) => {
    handleFiltersChange({ ...filters, status: filters.status === slug ? 'all' : slug });
  }, [filters, handleFiltersChange]);

  const toggleWindowChip = useCallback((value: 'open' | 'closed') => {
    handleFiltersChange({ ...filters, whatsappWindow: filters.whatsappWindow === value ? 'all' : value });
  }, [filters, handleFiltersChange]);

  const userName = user?.user_metadata?.display_name || user?.email || 'Sistema';

  return (
    <AppLayout>
      <AppHeader
        title="Ganhadores"
        subtitle={`${winners.length} registrados`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setNewWinnerOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
              Novo
            </Button>
            {can(PERMISSIONS.GANHADOR_IMPORTAR) && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setImportActionSelectorOpen(true)}>
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Importar
              </Button>
            )}
            {selected.size > 0 && (
              <>
                <Button size="sm" className="h-8 text-xs" onClick={() => setPixModalOpen(true)}>
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Pix ({selected.size})
                </Button>
                {can(PERMISSIONS.GANHADOR_ALTERAR_STATUS) && (
                  <>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setBatchStatusOpen(true)}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Status ({selected.size})
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => setBulkDeleteOpen(true)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Excluir ({selected.size})
                    </Button>
                  </>
                )}
              </>
            )}
            {can(PERMISSIONS.GANHADOR_GERAR_LOTE) && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setBatchGeneratorOpen(true)}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                Lote
              </Button>
            )}
            {can(PERMISSIONS.FINANCEIRO_VER_LOTES) && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setBatchHistoryOpen(true)}>
                <History className="h-3.5 w-3.5 mr-1.5" />
                Histórico Lotes
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        {/* Pendentes / Concluídos Tabs */}
        <Tabs value={winnersTab} onValueChange={(v) => { setWinnersTab(v as 'pending' | 'completed'); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="pending" className="text-xs">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Pendentes ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Concluídos ({completedCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Configurable Quick Filter Chips */}
        {quickFilterConfig.length > 0 ? (
          <div className="flex flex-wrap gap-2 items-center">
            {quickFilterConfig.map(qf => {
              if (qf.filter_type === 'status') {
                const status = activeOrdered.find(s => s.slug === qf.filter_value);
                if (!status) return null;
                const count = statusCounts[status.slug] || 0;
                const active = filters.status === status.slug;
                return (
                  <button
                    key={`status-${status.slug}`}
                    onClick={() => toggleStatusChip(status.slug)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                      active
                        ? 'text-white border-transparent'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted',
                    )}
                    style={active ? { backgroundColor: status.color, borderColor: status.color } : undefined}
                  >
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: active ? 'white' : status.color }}
                    />
                    {status.name}
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0 rounded-full',
                      active ? 'bg-white/25' : 'bg-muted'
                    )}>
                      {count}
                    </span>
                  </button>
                );
              }
              if (qf.filter_type === 'window') {
                const wf = WINDOW_FILTERS_MAP[qf.filter_value];
                if (!wf) return null;
                const active = filters.whatsappWindow === wf.windowValue;
                return (
                  <button
                    key={`window-${qf.filter_value}`}
                    onClick={() => toggleWindowChip(wf.windowValue)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted',
                    )}
                  >
                    <MessageSquare className="h-3 w-3" />
                    {wf.label}
                  </button>
                );
              }
              return null;
            })}
          </div>
        ) : !quickFiltersLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Filter className="h-3.5 w-3.5" />
            <span>Nenhum filtro rápido configurado.</span>
            <a href="/settings?tab=quick-filters" className="text-primary hover:underline font-medium">
              Configurar
            </a>
          </div>
        ) : null}

        <WinnersFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          actionsMap={actionsMap}
          showValueFilter={can(PERMISSIONS.FINANCEIRO_VER_DASHBOARD)}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            {filters.search || filters.status !== 'all' ? 'Nenhum ganhador encontrado.' : 'Nenhum ganhador registrado ainda.'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-3 w-10">
                        <Checkbox
                          checked={selected.size > 0 && paginated.every(w => selected.has(w.id))}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Nome</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Telefone</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">CPF</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Ação</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Tipo</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Valor</th>
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
                    {paginated.map((w, i) => {
                       const windowOpen = isWindowOpen(w.lastInboundAt);
                      const canRequestPix = ['imported', 'pix_refused'].includes(w.status);
                      const opPix = resolveOperationalPixKey(w.pixKey, w.cpf, w.phone, w.status);
                      return (
                        <tr
                          key={w.id}
                          className={cn(
                            'border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in',
                            selected.has(w.id) && 'bg-primary/5',
                          )}
                          style={{ animationDelay: `${i * 20}ms` }}
                        >
                          <td className="px-3 py-2.5">
                            <Checkbox checked={selected.has(w.id)} onCheckedChange={() => toggleWinner(w.id)} />
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="text-sm font-medium">{w.name}</p>
                            {w.fullName && w.fullName !== w.name && (
                              <p className="text-[10px] text-muted-foreground">{w.fullName}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                            {formatPhone(w.phone)}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                            {formatCpf(w.cpf)}
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{w.actionName}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {w.prizeTitle}
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-medium">
                            {formatCurrency(w.value)}
                          </td>
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
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {canRequestPix && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={e => { e.stopPropagation(); handleSingleRequestPix(w); }}>
                                      <Send className="h-5 w-5 text-info" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Solicitar Pix</TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={e => { e.stopPropagation(); setPixTarget(w); }}>
                                    <CreditCard className={cn('h-5 w-5', w.pixKey ? 'text-purple' : 'text-muted-foreground')} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{w.pixKey ? 'Editar Pix' : 'Cadastrar Pix'}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={e => { e.stopPropagation(); setReceiptTarget(w); }}>
                                    <Paperclip className={cn('h-5 w-5', w.receiptUrl ? 'text-success' : 'text-muted-foreground')} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{w.receiptUrl ? 'Gerenciar Comprovante' : 'Anexar Comprovante'}</TooltipContent>
                              </Tooltip>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-muted transition-colors">
                                    <Info className={cn('h-5 w-5', w.lastPixError ? 'text-destructive' : 'text-muted-foreground')} />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="left" className="w-80 text-xs space-y-2">
                                  <p className="font-semibold text-sm">Debug — Rastreio</p>
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Winner ID:</span>
                                      <span className="font-mono text-[10px] select-all">{w.id.slice(0, 8)}…</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Action ID:</span>
                                      <span className="font-mono text-[10px] select-all">{w.actionId.slice(0, 8)}…</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Phone E164:</span>
                                      <span className="font-mono text-[10px]">{w.phoneE164 || '—'}</span>
                                    </div>
                                    <hr className="border-border" />
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Último outbound:</span>
                                      <span className="font-mono">{w.lastOutboundAt ? formatRelativeTime(w.lastOutboundAt) : '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Último inbound:</span>
                                      <span className="font-mono">{w.lastInboundAt ? formatRelativeTime(w.lastInboundAt) : (w.ultimaInteracaoWhatsapp ? formatRelativeTime(w.ultimaInteracaoWhatsapp) : '—')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Última solicitação:</span>
                                      <span className="font-mono">{w.lastPixRequestAt ? formatRelativeTime(w.lastPixRequestAt) : '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Solicitado por:</span>
                                      <span>{w.lastPixRequestedBy || '—'}</span>
                                    </div>
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
                                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={e => { e.stopPropagation(); setHistoryTarget(w); }}>
                                    <History className="h-5 w-5 text-muted-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Histórico de Status</TooltipContent>
                              </Tooltip>
                              {can(PERMISSIONS.GANHADOR_EXCLUIR) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteWinner(w); }}>
                                      <Trash2 className="h-5 w-5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {paginated.map((w, i) => {
                const windowOpen = isWindowOpen(w.lastInboundAt);
                const canRequestPix = ['imported', 'pix_refused'].includes(w.status);
                return (
                  <div
                    key={w.id}
                    className={cn(
                      'rounded-xl border bg-card p-4 animate-fade-in transition-all',
                      selected.has(w.id) && 'ring-2 ring-primary',
                    )}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Checkbox
                          checked={selected.has(w.id)}
                          onCheckedChange={() => toggleWinner(w.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{w.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{formatPhone(w.phone)}</p>
                        </div>
                      </div>
                      <StatusBadge status={w.status} className="text-xs px-3 py-1 shrink-0" />
                    </div>

                    {/* Info */}
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate mr-2">{w.actionName}</span>
                        <span className="font-semibold shrink-0">{formatCurrency(w.value)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">{w.prizeTitle}</span>
                        {w.ultimaInteracaoWhatsapp && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-2 py-0.5 shrink-0',
                              windowOpen
                                ? 'bg-success/15 text-success border-success/30'
                                : 'bg-destructive/15 text-destructive border-destructive/30',
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
                      {(w.lastPixRequestAt || w.lastOutboundAt) && (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Info className="h-3 w-3 shrink-0" />
                          <span>Solic: {w.lastPixRequestAt ? formatRelativeTime(w.lastPixRequestAt) : '—'}</span>
                          <span>· Out: {w.lastOutboundAt ? formatRelativeTime(w.lastOutboundAt) : '—'}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons - Touch-friendly */}
                    <div className="flex gap-2 pt-3 border-t">
                      {canRequestPix && (
                        <Button variant="outline" size="sm" className="h-10 flex-1 text-xs" onClick={e => { e.stopPropagation(); handleSingleRequestPix(w); }}>
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
                      {can(PERMISSIONS.GANHADOR_EXCLUIR) && (
                        <Button variant="outline" size="sm" className="h-10 text-xs text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteWinner(w); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {/* Modals */}
      <RequestPixModal open={pixModalOpen} onOpenChange={setPixModalOpen} winners={selectedWinners} onConfirm={handleRequestPix} isPending={isPending} isAdmin={can(PERMISSIONS.GANHADOR_FORCAR_PIX)} />
      <NewWinnerModal open={newWinnerOpen} onOpenChange={setNewWinnerOpen} actionsMap={operationalActionsMap} />
      <DeleteWinnerDialog open={!!deleteWinner} onOpenChange={v => { if (!v) setDeleteWinner(null); }} winner={deleteWinner} actionName={deleteWinner ? (actionsMap[deleteWinner.actionId] || '') : ''} />
      <BulkDeleteWinnersDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} winners={selectedWinners} actionsMap={actionsMap} onDone={() => setSelected(new Set())} />
      <BatchStatusModal open={batchStatusOpen} onOpenChange={setBatchStatusOpen} winnerIds={Array.from(selected)} currentStatuses={selectedWinners.map(w => w.status)} onDone={() => setSelected(new Set())} />
      <PixDataModal open={!!pixTarget} onOpenChange={v => { if (!v) setPixTarget(null); }} winner={pixTarget} isAdmin={can(PERMISSIONS.GANHADOR_EDITAR)} userName={userName} actionId={pixTarget?.actionId || ''} />
      <ReceiptManager open={!!receiptTarget} onOpenChange={v => { if (!v) setReceiptTarget(null); }} winner={receiptTarget} userName={userName} actionId={receiptTarget?.actionId || ''} actionName={receiptTarget ? (actionsMap[receiptTarget.actionId] || '') : ''} />
      <BatchGeneratorModal open={batchGeneratorOpen} onOpenChange={setBatchGeneratorOpen} winners={winners} actionId="" actionName="Todos" userName={userName} actionsMap={actionsMap} />
      <StatusHistorySheet open={!!historyTarget} onOpenChange={v => { if (!v) setHistoryTarget(null); }} winnerId={historyTarget?.id || null} winnerName={historyTarget?.name || ''} />

      {/* Import: Action Selector Dialog */}
      <Dialog open={importActionSelectorOpen} onOpenChange={setImportActionSelectorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecionar Ação para Importação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={importActionId} onValueChange={setImportActionId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma ação..." />
              </SelectTrigger>
              <SelectContent>
                {actions.filter(a => a.status !== 'planning' && a.status !== 'archived').map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!importActionId}
              onClick={() => {
                setImportActionSelectorOpen(false);
                setImportModalOpen(true);
              }}
            >
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {importActionId && (
        <ImportWinnersModal
          open={importModalOpen}
          onClose={() => { setImportModalOpen(false); setImportActionId(''); }}
          actionId={importActionId}
          actionName={actionsMap[importActionId] || ''}
        />
      )}
    </AppLayout>
  );
}
