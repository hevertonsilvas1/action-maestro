import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { OperationalDashboard } from '@/components/operational/OperationalDashboard';
import { useActions } from '@/hooks/useActions';
import { useWinners } from '@/hooks/useWinners';
import { useUserRole } from '@/hooks/useUserRole';
import { formatCurrency, formatPercent, formatDate } from '@/lib/format';
import {
  DollarSign, TrendingUp, Users, Megaphone, ArrowRight, Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ACTION_STATUS_LABELS, ACTION_STATUS_COLORS } from '@/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const Index = () => {
  const { data: actions = [], isLoading: loadingActions } = useActions();
  const { isAdmin, loading: loadingRole } = useUserRole();
  const isLoading = loadingActions || loadingRole;

  const operationalActions = actions.filter(a => a.status !== 'archived');
  const totalRevenue = operationalActions.reduce((s, a) => s + a.expectedRevenue, 0);
  const totalProfit = operationalActions.reduce((s, a) => s + a.grossProfit, 0);
  const totalWinners = operationalActions.reduce((s, a) => s + a.winnersCount, 0);
  const totalPaid = operationalActions.reduce((s, a) => s + a.paidCount, 0);
  const activeActions = operationalActions.filter(a => a.status === 'active').length;

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
        subtitle={isAdmin ? 'Visão financeira e operacional' : 'Visão operacional da fila de trabalho'}
        actions={
          isAdmin ? (
            <Link to="/actions">
              <Button size="sm" className="gradient-primary text-primary-foreground hover:opacity-90 h-8 text-xs">
                <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                Nova Ação
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-8">
        {/* ═══ PAINEL FINANCEIRO (Admin only) ═══ */}
        {isAdmin && (
          <section className="space-y-5">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Painel Financeiro</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard title="Receita Total" value={formatCurrency(totalRevenue)} icon={DollarSign} variant="primary" />
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
              <StatsCard title="Ações Ativas" value={String(activeActions)} icon={Megaphone} variant="warning" subtitle={`${operationalActions.length} total`} />
            </div>

            {/* Recent Actions */}
            <div className="rounded-xl border bg-card p-4 lg:p-5">
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
                    const progress = action.winnersCount > 0 ? (action.paidCount / action.winnersCount) * 100 : 0;
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
                            <StatusBadge status={action.status} labels={ACTION_STATUS_LABELS} colors={ACTION_STATUS_COLORS} />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatCurrency(action.expectedRevenue)}</span>
                            <span>{action.winnersCount} ganhadores</span>
                            <span>·</span>
                            <span>{formatDate(action.updatedAt)}</span>
                          </div>
                          {action.winnersCount > 0 && (
                            <div className="flex items-center gap-2">
                              <Progress value={progress} className="h-1.5 flex-1" />
                              <span className="text-[10px] font-medium text-muted-foreground">{progress.toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-success">{formatCurrency(action.grossProfit)}</p>
                          <p className="text-[10px] text-muted-foreground">{formatPercent(action.marginPercent)} margem</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Divider */}
        {isAdmin && <div className="border-t border-border" />}

        {/* ═══ PAINEL OPERACIONAL (Everyone) ═══ */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent-foreground" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-accent-foreground">Painel Operacional</h2>
          </div>
          <OperationalDashboard />
        </section>
      </div>
    </AppLayout>
  );
};

export default Index;
