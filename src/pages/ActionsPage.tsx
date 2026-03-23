import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { useActions } from '@/hooks/useActions';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/format';
import { ACTION_STATUS_LABELS, ACTION_STATUS_COLORS } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, Search, ArrowUpDown, Loader2, Copy, Trash2, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { useDuplicateAction } from '@/hooks/useDuplicateAction';
import { useDeleteAction, validateActionDeletion } from '@/hooks/useDeleteAction';
import { useArchiveAction } from '@/hooks/useArchiveAction';
import { DeleteActionDialog } from '@/components/DeleteActionDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type StatusFilter = 'all' | 'active_only' | 'planning' | 'active' | 'completed' | 'archived';

export default function ActionsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data: actions = [], isLoading } = useActions();
  const { can } = usePermissions();
  const { duplicate, isPending: isDuplicating } = useDuplicateAction();
  const { deleteAction, isPending: isDeleting } = useDeleteAction();
  const { archive, isPending: isArchiving } = useArchiveAction();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteBlockReason, setDeleteBlockReason] = useState<string | null>(null);

  const handleDuplicate = async (actionId: string) => {
    setDuplicatingId(actionId);
    try { await duplicate(actionId); } finally { setDuplicatingId(null); }
  };

  const handleArchive = async (actionId: string) => {
    setArchivingId(actionId);
    try { await archive(actionId); } finally { setArchivingId(null); }
  };

  const handleDeleteClick = async (actionId: string, actionName: string) => {
    const validation = await validateActionDeletion(actionId);
    setDeleteBlockReason(validation.canDelete ? null : (validation.reason ?? null));
    setDeleteTarget({ id: actionId, name: actionName });
  };

  // Default: hide archived. 'all' means all non-archived.
  const filtered = actions.filter((a) => {
    if (!a.name.toLowerCase().includes(search.toLowerCase())) return false;
    switch (statusFilter) {
      case 'all': return a.status !== 'archived';
      case 'active_only': return a.status === 'active';
      case 'planning': return a.status === 'planning';
      case 'completed': return a.status === 'completed';
      case 'archived': return a.status === 'archived';
      default: return true;
    }
  });

  const nonArchivedCount = actions.filter(a => a.status !== 'archived').length;

  return (
    <AppLayout>
      <AppHeader
        title="Ações"
        subtitle={`${nonArchivedCount} ações cadastradas`}
        actions={
          <Link to="/actions/new">
            <Button size="sm" className="gradient-primary text-primary-foreground hover:opacity-90 h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nova Ação
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ações..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas (não arquivadas)</SelectItem>
              <SelectItem value="planning">Planejamento</SelectItem>
              <SelectItem value="active_only">Ativas</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="archived">Arquivadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            {search || statusFilter !== 'all' ? 'Nenhuma ação encontrada.' : 'Nenhuma ação cadastrada ainda.'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Ação</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Cotas</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Vlr Cota</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Receita</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Custo Plan.</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Lucro</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Margem</th>
                    <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Progresso</th>
                    {can(PERMISSIONS.ACAO_EDITAR) && <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((action, i) => {
                    const progress = action.plannedWinners > 0
                      ? (action.winnersCount / action.plannedWinners) * 100
                      : 0;
                    const isArchived = action.status === 'archived';
                    return (
                      <tr
                        key={action.id}
                        className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in ${isArchived ? 'opacity-60' : ''}`}
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="px-4 py-3">
                          <Link to={`/actions/${action.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                            {action.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={action.status} labels={ACTION_STATUS_LABELS} colors={ACTION_STATUS_COLORS} />
                        </td>
                        <td className="px-4 py-3 text-right text-sm">{formatNumber(action.quotaCount)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatCurrency(action.quotaValue)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatCurrency(action.expectedRevenue)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatCurrency(action.totalCost)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-success">
                          {formatCurrency(action.grossProfit)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">{formatPercent(action.marginPercent)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Progress value={progress} className="h-1.5 w-20" />
                            <span className="text-[10px] text-muted-foreground w-8 text-right">{progress.toFixed(0)}%</span>
                          </div>
                        </td>
                        {can(PERMISSIONS.ACAO_EDITAR) && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost" size="sm" className="h-7 text-xs"
                                onClick={(e) => { e.preventDefault(); handleDuplicate(action.id); }}
                                disabled={duplicatingId === action.id}
                              >
                                {duplicatingId === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3 mr-1" />}
                                Duplicar
                              </Button>
                              {!isArchived && (
                                <Button
                                  variant="ghost" size="sm" className="h-7 text-xs"
                                  onClick={(e) => { e.preventDefault(); handleArchive(action.id); }}
                                  disabled={archivingId === action.id}
                                >
                                  {archivingId === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3 mr-1" />}
                                  Arquivar
                                </Button>
                              )}
                              {!isArchived && (
                                <Button
                                  variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                                  onClick={(e) => { e.preventDefault(); handleDeleteClick(action.id, action.name); }}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Excluir
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((action, i) => {
                const progress = action.plannedWinners > 0
                  ? (action.winnersCount / action.plannedWinners) * 100
                  : 0;
                const isArchived = action.status === 'archived';
                return (
                  <Link
                    key={action.id}
                    to={`/actions/${action.id}`}
                    className={`block rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-card-hover animate-fade-in ${isArchived ? 'opacity-60' : ''}`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-semibold">{action.name}</p>
                      <StatusBadge status={action.status} labels={ACTION_STATUS_LABELS} colors={ACTION_STATUS_COLORS} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <p className="text-muted-foreground">Receita</p>
                        <p className="font-medium">{formatCurrency(action.expectedRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lucro</p>
                        <p className="font-semibold text-success">{formatCurrency(action.grossProfit)}</p>
                      </div>
                    </div>
                    {action.winnersCount > 0 && (
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground">{action.paidCount}/{action.winnersCount}</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <DeleteActionDialog
          open={!!deleteTarget}
          onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
          actionName={deleteTarget.name}
          blockReason={deleteBlockReason}
          isPending={isDeleting}
          onConfirm={async () => { await deleteAction(deleteTarget.id); setDeleteTarget(null); }}
        />
      )}
    </AppLayout>
  );
}
