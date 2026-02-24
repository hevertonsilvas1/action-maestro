import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { useWinners } from '@/hooks/useWinners';
import { useActions } from '@/hooks/useActions';
import { formatCurrency, formatPhone } from '@/lib/format';
import { formatRelativeTime, isWindowOpen } from '@/lib/time';
import { maskPixKey, getPixStatus } from '@/lib/pix-validation';
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
import { Download, Loader2, Send, PlusCircle, Trash2, AlertCircle, RefreshCw, CreditCard, ShieldCheck, AlertTriangle, Paperclip, FileSpreadsheet, MessageSquare } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import type { Winner } from '@/types';

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

  const isLoading = loadingWinners || loadingActions;

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
    [allWinners, filters]
  );

  const paginated = useMemo(
    () => paginateArray(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const handleFiltersChange = useCallback((f: typeof filters) => {
    setFilters(f);
    setPage(1);
  }, [setFilters]);

  const toggleWinner = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === paginated.length
        ? new Set()
        : new Set(paginated.map((w) => w.id))
    );
  }, [paginated]);

  const selectedWinners = useMemo(
    () => winners.filter((w) => selected.has(w.id)),
    [winners, selected]
  );

  const handleRequestPix = async () => {
    const eligible = getEligibleWinners(selectedWinners);
    if (eligible.length === 0) return;
    await requestPix(eligible);
    setPixModalOpen(false);
    setSelected(new Set());
  };

  return (
    <AppLayout>
      <AppHeader
        title="Ganhadores"
        subtitle={`${winners.length} ganhadores registrados`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setNewWinnerOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
              Novo Ganhador
            </Button>
            {selected.size > 0 && (
              <>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setPixModalOpen(true)}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Solicitar Pix ({selected.size})
                </Button>
                {isAdmin && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setBatchStatusOpen(true)}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Alterar Status ({selected.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-destructive hover:text-destructive"
                      onClick={() => setBulkDeleteOpen(true)}
                    >
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
                Gerar Lote PIX
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
            {filters.search ? 'Nenhum ganhador encontrado.' : 'Nenhum ganhador registrado ainda.'}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 w-10">
                        <Checkbox
                          checked={selected.size > 0 && paginated.every((w) => selected.has(w.id))}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Nome</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Telefone</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Ação</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Prêmio</th>
                      {isAdmin && <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Valor</th>}
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Data/Hora</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Tipo PIX</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Chave Pix</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Últ. Solicitação</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Últ. Interação</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Erro</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Comprovante</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                      {isAdmin && <th className="px-2 py-3 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((w, i) => {
                      const windowOpen = isWindowOpen(w.ultimaInteracaoWhatsapp);
                      return (
                        <tr
                          key={w.id}
                          className="border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in"
                          style={{ animationDelay: `${i * 30}ms` }}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selected.has(w.id)}
                              onCheckedChange={() => toggleWinner(w.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium">{w.name}</p>
                            {w.fullName && w.fullName !== w.name && <p className="text-[10px] text-muted-foreground">{w.fullName}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{formatPhone(w.phone)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{w.actionName}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{w.prizeTitle}</td>
                          {isAdmin && <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(w.value)}</td>}
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {w.prizeDatetime ? new Date(w.prizeDatetime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {w.pixType ? (
                              <Badge variant="outline" className="text-[10px]">{w.pixType?.toUpperCase()}</Badge>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                              onClick={(e) => { e.stopPropagation(); setPixTarget(w); }}
                            >
                              {(() => {
                                const ps = getPixStatus(w);
                                if (ps === 'validated') return <><ShieldCheck className="h-3 w-3 text-success" />{maskPixKey(w.pixType, w.pixKey)}</>;
                                if (ps === 'filled') return <><CreditCard className="h-3 w-3 text-info" />{maskPixKey(w.pixType, w.pixKey)}</>;
                                return <><AlertTriangle className="h-3 w-3 text-muted-foreground" />Cadastrar</>;
                              })()}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-[10px] text-muted-foreground">
                            {w.lastPixRequestAt
                              ? new Date(w.lastPixRequestAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                              : '—'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {formatRelativeTime(w.ultimaInteracaoWhatsapp)}
                              </span>
                              {w.ultimaInteracaoWhatsapp && (
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] px-1.5 py-0 ${
                                    windowOpen
                                      ? 'bg-success/15 text-success border-success/30'
                                      : 'bg-destructive/15 text-destructive border-destructive/30'
                                  }`}
                                >
                                  <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                                  {windowOpen ? 'Aberta' : 'Fechada'}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {w.lastPixError ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 text-[10px] text-destructive cursor-help">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs text-xs">
                                  {w.lastPixError}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                              onClick={(e) => { e.stopPropagation(); setReceiptTarget(w); }}
                            >
                              {w.receiptUrl ? (
                                <><Paperclip className="h-3 w-3 text-success" />v{w.receiptVersion}</>
                              ) : (
                                <span className="text-[10px]">—</span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={w.status} />
                          </td>
                          {isAdmin && (
                            <td className="px-2 py-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteWinner(w)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {paginated.map((w, i) => {
                const windowOpen = isWindowOpen(w.ultimaInteracaoWhatsapp);
                return (
                  <div
                    key={w.id}
                    className={`rounded-xl border bg-card p-4 animate-fade-in cursor-pointer transition-colors ${selected.has(w.id) ? 'ring-2 ring-primary' : ''}`}
                    style={{ animationDelay: `${i * 50}ms` }}
                    onClick={() => toggleWinner(w.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selected.has(w.id)}
                          onCheckedChange={() => toggleWinner(w.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div>
                          <p className="text-sm font-semibold">{w.name}</p>
                          <p className="text-[10px] text-muted-foreground">{w.actionName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {w.ultimaInteracaoWhatsapp && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 ${
                              windowOpen
                                ? 'bg-success/15 text-success border-success/30'
                                : 'bg-destructive/15 text-destructive border-destructive/30'
                            }`}
                          >
                            {windowOpen ? 'Aberta' : 'Fechada'}
                          </Badge>
                        )}
                        {w.lastPixError && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs">{w.lastPixError}</TooltipContent>
                          </Tooltip>
                        )}
                        <StatusBadge status={w.status} />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{w.prizeTitle}</span>
                      {isAdmin && <span className="font-medium">{formatCurrency(w.value)}</span>}
                    </div>
                    {w.ultimaInteracaoWhatsapp && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Últ. interação: {formatRelativeTime(w.ultimaInteracaoWhatsapp)}
                      </p>
                    )}
                    {w.lastPixRequestAt && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Últ. solicitação: {new Date(w.lastPixRequestAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    )}
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

      <RequestPixModal
        open={pixModalOpen}
        onOpenChange={setPixModalOpen}
        winners={selectedWinners}
        onConfirm={handleRequestPix}
        isPending={isPending}
        isAdmin={isAdmin}
      />

      <NewWinnerModal
        open={newWinnerOpen}
        onOpenChange={setNewWinnerOpen}
        actionsMap={actionsMap}
      />

      <DeleteWinnerDialog
        open={!!deleteWinner}
        onOpenChange={(v) => { if (!v) setDeleteWinner(null); }}
        winner={deleteWinner}
        actionName={deleteWinner ? (actionsMap[deleteWinner.actionId] || '') : ''}
      />

      <BulkDeleteWinnersDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        winners={selectedWinners}
        actionsMap={actionsMap}
        onDone={() => setSelected(new Set())}
      />

      <BatchStatusModal
        open={batchStatusOpen}
        onOpenChange={setBatchStatusOpen}
        winnerIds={Array.from(selected)}
        onDone={() => setSelected(new Set())}
      />

      <PixDataModal
        open={!!pixTarget}
        onOpenChange={(v) => { if (!v) setPixTarget(null); }}
        winner={pixTarget}
        isAdmin={isAdmin}
        userName={user?.user_metadata?.display_name || user?.email || 'Sistema'}
        actionId={pixTarget?.actionId || ''}
      />

      <ReceiptManager
        open={!!receiptTarget}
        onOpenChange={(v) => { if (!v) setReceiptTarget(null); }}
        winner={receiptTarget}
        userName={user?.user_metadata?.display_name || user?.email || 'Sistema'}
        actionId={receiptTarget?.actionId || ''}
        actionName={receiptTarget ? (actionsMap[receiptTarget.actionId] || '') : ''}
      />

      <BatchGeneratorModal
        open={batchGeneratorOpen}
        onOpenChange={setBatchGeneratorOpen}
        winners={winners}
        actionId=""
        actionName="Todos"
        userName={user?.user_metadata?.display_name || user?.email || 'Sistema'}
      />
    </AppLayout>
  );
}
