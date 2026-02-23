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
import { formatCurrency, formatPercent, formatDate } from '@/lib/format';
import { ACTION_STATUS_LABELS, ACTION_STATUS_COLORS, WinnerStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, TrendingUp, Users, ArrowLeft, Trophy, Receipt,
  PlusCircle, Download, Send, FileSpreadsheet, CheckCircle2,
  Target, Loader2, Pencil, Copy, Trash2, Archive, RotateCcw, Clock,
  History, User,
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useDuplicateAction } from '@/hooks/useDuplicateAction';
import { useDeleteAction, validateActionDeletion } from '@/hooks/useDeleteAction';
import { useArchiveAction, useRestoreAction } from '@/hooks/useArchiveAction';
import { DeleteActionDialog } from '@/components/DeleteActionDialog';
import { useState } from 'react';

export default function ActionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: action, isLoading: loadingAction } = useAction(id);
  const { data: winners = [], isLoading: loadingWinners } = useWinners(id);
  const { data: prizes = [], isLoading: loadingPrizes } = usePrizes(id ?? '');
  const { data: costs = [], isLoading: loadingCosts } = useCosts(id ?? '');
  const { data: auditLog = [] } = useAuditLog(id);
  const { isAdmin } = useUserRole();
  const { duplicate, isPending: isDuplicating } = useDuplicateAction();
  const { deleteAction, isPending: isDeleting } = useDeleteAction();
  const { archive, isPending: isArchiving } = useArchiveAction();
  const { restore, isPending: isRestoring } = useRestoreAction();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBlockReason, setDeleteBlockReason] = useState<string | null>(null);

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

  const totalPlannedPrizes = prizes.reduce((s, p) => s + p.totalValue, 0);
  const totalPaidPrizes = winners
    .filter((w) => w.status === 'paid' || w.status === 'receipt_sent')
    .reduce((s, w) => s + w.value, 0);
  const totalCosts = costs.reduce((s, c) => s + c.value, 0);

  const statusCounts: Record<string, number> = {};
  winners.forEach((w) => {
    statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
  });

  const paidProgress = winners.length > 0
    ? (winners.filter(w => w.status === 'paid' || w.status === 'receipt_sent').length / winners.length) * 100
    : 0;

  const isArchived = action.status === 'archived';

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
            <StatusBadge
              status={action.status}
              labels={ACTION_STATUS_LABELS}
              colors={ACTION_STATUS_COLORS}
            />
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* KPIs - Admin only */}
        {isAdmin && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <StatsCard title="Receita Esperada" value={formatCurrency(action.expectedRevenue)} icon={DollarSign} variant="primary" />
            <StatsCard title="Lucro Bruto" value={formatCurrency(action.grossProfit)} icon={TrendingUp} variant="success" subtitle={`${formatPercent(action.marginPercent)} margem`} />
            <StatsCard title="Total Pago" value={formatCurrency(action.realPaid)} icon={CheckCircle2} variant="accent" />
            <StatsCard title="Ganhadores" value={String(action.winnersCount)} icon={Users} subtitle={`${action.paidCount} pagos`} />
          </div>
        )}

        {/* Support sees only winner count KPI */}
        {!isAdmin && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <StatsCard title="Ganhadores" value={String(action.winnersCount)} icon={Users} subtitle={`${action.paidCount} pagos`} />
            <StatsCard title="Pendentes" value={String(action.winnersCount - action.paidCount)} icon={Clock} variant="warning" />
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
                    <span className="font-medium">{formatCurrency(totalPaidPrizes)} / {formatCurrency(totalPlannedPrizes)}</span>
                  </div>
                  <Progress value={totalPlannedPrizes > 0 ? (totalPaidPrizes / totalPlannedPrizes) * 100 : 0} className="h-2" />
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                  <div className="text-center">
                    <p className="text-lg font-bold">{formatCurrency(action.totalCost)}</p>
                    <p className="text-[10px] text-muted-foreground">Custo Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-success">{formatCurrency(action.grossProfit)}</p>
                    <p className="text-[10px] text-muted-foreground">Lucro Bruto</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{formatCurrency(totalPlannedPrizes - totalPaidPrizes)}</p>
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
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Importar Ganhadores
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Solicitar Pix
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                Gerar Planilha de Lote
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exportar
              </Button>
            </div>

            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Nome</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Prêmio</th>
                      {isAdmin && <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Valor</th>}
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Chave Pix</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winners.length === 0 ? (
                      <tr><td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum ganhador registrado.</td></tr>
                    ) : (
                      winners.map((w, i) => (
                        <tr
                          key={w.id}
                          className="border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in"
                          style={{ animationDelay: `${i * 30}ms` }}
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium">{w.name}</p>
                            {w.fullName && <p className="text-[10px] text-muted-foreground">{w.fullName}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{w.prizeTitle}</td>
                          {isAdmin && <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(w.value)}</td>}
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                            {w.pixKey || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={w.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="prizes" className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Total planejado: <span className="font-semibold text-foreground">{formatCurrency(totalPlannedPrizes)}</span>
              </p>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Adicionar Prêmio
              </Button>
            </div>
            {prizes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum prêmio cadastrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prizes.map((p, i) => (
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
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{p.quantity}x</span>
                      <span>{formatCurrency(p.unitValue)}/un</span>
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
                        const rows = auditLog.map((entry) => {
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
                      Exportar CSV
                    </Button>
                  )}
                </div>
                {auditLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro de auditoria.</p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-auto">
                    {auditLog.map((entry) => {
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
                                {opLabels[entry.operation] || entry.operation}
                              </span>
                              <span className="text-muted-foreground">
                                {tableLabels[entry.tableName] || entry.tableName}
                              </span>
                            </div>
                            <span className="text-muted-foreground text-[10px]">
                              {new Date(entry.createdAt).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="font-medium text-foreground">{entry.userName || 'Sistema'}</span>
                            {entry.userRole && (
                              <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px]">
                                {roleLabels[entry.userRole] || entry.userRole}
                              </span>
                            )}
                          </div>
                          {entry.changes && Object.keys(entry.changes).length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-border/50">
                              {Object.entries(entry.changes).map(([key, val]) => {
                                if (val && typeof val === 'object' && 'before' in val && 'after' in val) {
                                  return (
                                    <div key={key} className="flex flex-wrap gap-1.5 items-baseline">
                                      <span className="text-muted-foreground font-medium min-w-[120px]">{key}:</span>
                                      <span className="text-destructive line-through">{String(val.before ?? '—')}</span>
                                      <span className="text-muted-foreground">→</span>
                                      <span className="text-success font-medium">{String(val.after ?? '—')}</span>
                                    </div>
                                  );
                                }
                                if (Array.isArray(val)) {
                                  return (
                                    <div key={key}>
                                      <span className="text-muted-foreground font-medium">{key}:</span>
                                      <ul className="ml-4 list-disc">
                                        {val.map((item, idx) => <li key={idx}>{String(item)}</li>)}
                                      </ul>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={key} className="flex gap-1.5">
                                    <span className="text-muted-foreground font-medium">{key}:</span>
                                    <span>{String(val)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
    </AppLayout>
  );
}
