import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useActions } from '@/hooks/useActions';
import { useWinners } from '@/hooks/useWinners';
import { formatCurrency, formatPercent, formatDate } from '@/lib/format';
import {
  DollarSign,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Megaphone,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ACTION_STATUS_LABELS, ACTION_STATUS_COLORS, WinnerStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const Index = () => {
  const { data: actions = [], isLoading: loadingActions } = useActions();
  const { data: winners = [], isLoading: loadingWinners } = useWinners();

  const isLoading = loadingActions || loadingWinners;

  // Exclude archived from operational KPIs
  const operationalActions = actions.filter(a => a.status !== 'archived');
  const totalRevenue = operationalActions.reduce((s, a) => s + a.expectedRevenue, 0);
  const totalProfit = operationalActions.reduce((s, a) => s + a.grossProfit, 0);
  const totalWinners = operationalActions.reduce((s, a) => s + a.winnersCount, 0);
  const totalPaid = operationalActions.reduce((s, a) => s + a.paidCount, 0);
  const activeActions = operationalActions.filter((a) => a.status === 'active').length;

  const statusCounts: Record<string, number> = {};
  winners.forEach((w) => {
    statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
  });

  // Operational KPIs (same as support dashboard)
  const pending = winners.filter(w => ['imported', 'pix_requested'].includes(w.status));
  const inProcess = winners.filter(w => ['pix_received', 'sent_to_batch'].includes(w.status));
  const refused = winners.filter(w => w.status === 'pix_refused');
  const completed = winners.filter(w => ['receipt_attached', 'receipt_sent'].includes(w.status));
  const withErrors = winners.filter(w => !!w.lastPixError);
  const today = new Date().toISOString().slice(0, 10);
  const paidToday = completed.filter(w =>
    w.createdAt?.slice(0, 10) === today
  ).length;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AppHeader
        title="Dashboard"
        subtitle="Visão geral das ações e pagamentos"
        actions={
          <Link to="/actions">
            <Button size="sm" className="gradient-primary text-primary-foreground hover:opacity-90 h-8 text-xs">
              <Megaphone className="h-3.5 w-3.5 mr-1.5" />
              Nova Ação
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Receita Total"
            value={formatCurrency(totalRevenue)}
            icon={DollarSign}
            variant="primary"
          />
          <StatsCard
            title="Lucro Bruto"
            value={formatCurrency(totalProfit)}
            icon={TrendingUp}
            variant="success"
            trend={totalRevenue > 0 ? { value: formatPercent((totalProfit / totalRevenue) * 100) + ' margem', positive: true } : undefined}
          />
          <StatsCard
            title="Ganhadores"
            value={String(totalWinners)}
            icon={Users}
            variant="accent"
            subtitle={`${totalPaid} pagos · ${totalWinners - totalPaid} pendentes`}
          />
          <StatsCard
            title="Ações Ativas"
            value={String(activeActions)}
            icon={Megaphone}
            variant="warning"
            subtitle={`${operationalActions.length} total`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Recent Actions */}
          <div className="lg:col-span-2 rounded-xl border bg-card p-4 lg:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Ações Recentes</h2>
              <Link to="/actions" className="text-xs text-primary hover:underline flex items-center gap-1">
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma ação cadastrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {operationalActions.slice(0, 5).map((action, i) => {
                  const progress = action.winnersCount > 0
                    ? (action.paidCount / action.winnersCount) * 100
                    : 0;
                  return (
                    <Link
                      key={action.id}
                      to={`/actions/${action.id}`}
                      className="flex items-center gap-4 rounded-lg border border-transparent p-3 transition-all duration-200 hover:bg-muted/50 hover:border-border animate-fade-in"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{action.name}</p>
                          <StatusBadge
                            status={action.status}
                            labels={ACTION_STATUS_LABELS}
                            colors={ACTION_STATUS_COLORS}
                          />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatCurrency(action.expectedRevenue)}</span>
                          <span>·</span>
                          <span>{action.winnersCount} ganhadores</span>
                          <span>·</span>
                          <span>{formatDate(action.updatedAt)}</span>
                        </div>
                        {action.winnersCount > 0 && (
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {progress.toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-success">
                          {formatCurrency(action.grossProfit)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatPercent(action.marginPercent)} margem
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Pipeline */}
          <div className="rounded-xl border bg-card p-4 lg:p-5">
            <h2 className="text-sm font-semibold mb-4">Pipeline de Pagamento</h2>
            {winners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum ganhador registrado.</p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
                      <StatusBadge status={status as WinnerStatus} />
                      <span className="text-sm font-semibold">{count}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Pagos</span>
                    <span className="text-xs font-semibold text-success">
                      {winners.filter(w => w.status === 'receipt_attached' || w.status === 'receipt_sent').length}/{winners.length}
                    </span>
                  </div>
                  <Progress
                    value={
                      (winners.filter(w => w.status === 'receipt_attached' || w.status === 'receipt_sent').length / winners.length) * 100
                    }
                    className="h-2"
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-warning/5">
                    <Clock className="h-4 w-4 text-warning mx-auto mb-1" />
                    <p className="text-xs font-semibold">
                      {winners.filter(w => ['imported', 'pix_requested'].includes(w.status)).length}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Pendente</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-info/5">
                    <AlertCircle className="h-4 w-4 text-info mx-auto mb-1" />
                    <p className="text-xs font-semibold">
                      {winners.filter(w => ['pix_received', 'sent_to_batch'].includes(w.status)).length}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Em processo</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-success/5">
                    <CheckCircle2 className="h-4 w-4 text-success mx-auto mb-1" />
                    <p className="text-xs font-semibold">
                      {winners.filter(w => ['receipt_attached', 'receipt_sent'].includes(w.status)).length}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Concluído</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Operational Overview (macro view) */}
        <div className="rounded-xl border bg-card p-4 lg:p-5">
          <h2 className="text-sm font-semibold mb-4">Visão Operacional</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatsCard
              title="Pendentes"
              value={String(pending.length)}
              icon={Clock}
              variant="warning"
              subtitle={formatCurrency(pending.reduce((s, w) => s + w.value, 0))}
            />
            <StatsCard
              title="Em Processo"
              value={String(inProcess.length)}
              icon={AlertCircle}
              variant="accent"
              subtitle={formatCurrency(inProcess.reduce((s, w) => s + w.value, 0))}
            />
            <StatsCard
              title="Pix Recusado"
              value={String(refused.length)}
              icon={AlertCircle}
              variant="destructive"
              subtitle={formatCurrency(refused.reduce((s, w) => s + w.value, 0))}
            />
            <StatsCard
              title="Concluídos"
              value={String(completed.length)}
              icon={CheckCircle2}
              variant="success"
              subtitle={`${paidToday} hoje · ${formatCurrency(completed.reduce((s, w) => s + w.value, 0))}`}
            />
            <StatsCard
              title="Com Erros"
              value={String(withErrors.length)}
              icon={AlertCircle}
              variant="destructive"
              subtitle="Falha no último envio"
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
