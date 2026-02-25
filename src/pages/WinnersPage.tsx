import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { useWinners } from '@/hooks/useWinners';
import { useActions } from '@/hooks/useActions';
import { formatCurrency, formatPhone } from '@/lib/format';
import { formatRelativeTime, isWindowOpen } from '@/lib/time';
import { StatusBadge } from '@/components/StatusBadge';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Download, Loader2, Send, PlusCircle, Trash2, AlertCircle,
  RefreshCw, CreditCard, Paperclip, FileSpreadsheet, MessageSquare,
  XCircle, Phone, UserX,
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { Winner } from '@/types';

const QUICK_FILTERS = [
  { key: 'pix_refused', label: 'Recusado', statusValue: 'pix_refused', icon: XCircle },
  { key: 'numero_inexistente', label: 'Nº Inexist.', statusValue: 'numero_inexistente', icon: Phone },
  { key: 'cliente_nao_responde', label: 'Não Resp.', statusValue: 'cliente_nao_responde', icon: UserX },
  { key: 'receipt_attached', label: 'Comp. Pendente', statusValue: 'receipt_attached', icon: Paperclip },
  { key: 'window_open', label: 'Janela Aberta', windowValue: 'open', icon: MessageSquare },
  { key: 'window_closed', label: 'Janela Fechada', windowValue: 'closed', icon: MessageSquare },
] as const;

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { filters, setFilters } = useWinnersFilters();
  const { isAdmin } = useUserRole();
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

  const actionsMap = useMemo(() => {
    const map: Record<string, string> = {};
    actions.forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [actions]);

  const { requestPix, isPending } = useRequestPixBatch(actionsMap);

  const allWinners = useMemo(() => winners.map((w) => ({
    ...w,
    actionName: actionsMap[w.actionId] ?? '',
  })), [winners, actionsMap]);

  const filtered = useMemo(
    () => applyWinnersFilters(allWinners, filters),
    [allWinners, filters],
  );

  const paginated = useMemo(
    () => paginateArray(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

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

  const isQuickActive = (qf: typeof QUICK_FILTERS[number]) => {
    if ('statusValue' in qf && qf.statusValue) return filters.status === qf.statusValue;
    if ('windowValue' in qf && qf.windowValue) return filters.whatsappWindow === qf.windowValue;
    return false;
  };

  const toggleQuick = (qf: typeof QUICK_FILTERS[number]) => {
    if (isQuickActive(qf)) {
      handleFiltersChange({
        ...filters,
        ...('statusValue' in qf && qf.statusValue ? { status: 'all' } : {}),
        ...('windowValue' in qf && qf.windowValue ? { whatsappWindow: 'all' as const } : {}),
      });
    } else {
      handleFiltersChange({
        ...filters,
        ...('statusValue' in qf && qf.statusValue ? { status: qf.statusValue } : {}),
        ...('windowValue' in qf && qf.windowValue ? { whatsappWindow: qf.windowValue as 'open' | 'closed' } : {}),
      });
    }
  };

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
            {selected.size > 0 && (
              <>
                <Button size="sm" className="h-8 text-xs" onClick={() => setPixModalOpen(true)}>
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Pix ({selected.size})
                </Button>
                {isAdmin && (
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
            {isAdmin && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setBatchGeneratorOpen(true)}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                Lote
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
        {/* Quick Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map(qf => {
            const active = isQuickActive(qf);
            const QfIcon = qf.icon;
            return (
              <button
                key={qf.key}
                onClick={() => toggleQuick(qf)}
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
          filters={filters}
          onFiltersChange={handleFiltersChange}
          actionsMap={actionsMap}
          showValueFilter={isAdmin}
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
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Ação</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Valor</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Status</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Janela</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((w, i) => {
                      const windowOpen = isWindowOpen(w.ultimaInteracaoWhatsapp);
                      const canRequestPix = ['imported', 'pix_refused'].includes(w.status);
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
                          <td className="px-3 py-2.5">
                            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{w.actionName}</p>
                            <p className="text-[10px] text-muted-foreground">{w.prizeTitle}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-medium">
                            {formatCurrency(w.value)}
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
                          <td className="px-2 py-2.5">
                            <div className="flex items-center justify-center gap-0.5">
                              {canRequestPix && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); handleSingleRequestPix(w); }}>
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
                              {w.lastPixError && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center justify-center h-8 w-8 cursor-help">
                                      <AlertCircle className="h-4 w-4 text-destructive" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs text-xs">{w.lastPixError}</TooltipContent>
                                </Tooltip>
                              )}
                              {isAdmin && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteWinner(w); }}>
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
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {paginated.map((w, i) => {
                const windowOpen = isWindowOpen(w.ultimaInteracaoWhatsapp);
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
                      {isAdmin && (
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
      <RequestPixModal open={pixModalOpen} onOpenChange={setPixModalOpen} winners={selectedWinners} onConfirm={handleRequestPix} isPending={isPending} isAdmin={isAdmin} />
      <NewWinnerModal open={newWinnerOpen} onOpenChange={setNewWinnerOpen} actionsMap={actionsMap} />
      <DeleteWinnerDialog open={!!deleteWinner} onOpenChange={v => { if (!v) setDeleteWinner(null); }} winner={deleteWinner} actionName={deleteWinner ? (actionsMap[deleteWinner.actionId] || '') : ''} />
      <BulkDeleteWinnersDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} winners={selectedWinners} actionsMap={actionsMap} onDone={() => setSelected(new Set())} />
      <BatchStatusModal open={batchStatusOpen} onOpenChange={setBatchStatusOpen} winnerIds={Array.from(selected)} onDone={() => setSelected(new Set())} />
      <PixDataModal open={!!pixTarget} onOpenChange={v => { if (!v) setPixTarget(null); }} winner={pixTarget} isAdmin={isAdmin} userName={userName} actionId={pixTarget?.actionId || ''} />
      <ReceiptManager open={!!receiptTarget} onOpenChange={v => { if (!v) setReceiptTarget(null); }} winner={receiptTarget} userName={userName} actionId={receiptTarget?.actionId || ''} actionName={receiptTarget ? (actionsMap[receiptTarget.actionId] || '') : ''} />
      <BatchGeneratorModal open={batchGeneratorOpen} onOpenChange={setBatchGeneratorOpen} winners={winners} actionId="" actionName="Todos" userName={userName} />
    </AppLayout>
  );
}
