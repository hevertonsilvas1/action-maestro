import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { OperationalDashboard } from '@/components/operational/OperationalDashboard';
import { useActions } from '@/hooks/useActions';
import { useWinners } from '@/hooks/useWinners';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { formatCurrency, formatPercent, formatDate } from '@/lib/format';
import {
  DollarSign, TrendingUp, Users, Megaphone, ArrowRight, Loader2,
  FileText, CheckCircle2, Send, Clock, Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ACTION_STATUS_LABELS, ACTION_STATUS_COLORS } from '@/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/StatusBadge';
import { useMemo } from 'react';

function DashboardBlock({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function MiniCard({ label, value, variant = 'default' }: { label: string; value: string; variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' }) {
  const styles = {
    default: 'border-border bg-card',
    primary: 'border-primary/20 bg-primary/5',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/30 bg-warning/5',
    destructive: 'border-destructive/30 bg-destructive/5',
  };
  return (
    <div className={`rounded-xl border p-3 lg:p-4 ${styles[variant]}`}>
      <p className="text-[11px] text-muted-foreground font-medium mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

const Index = () => {
  const { data: actions = [], isLoading: loadingActions } = useActions();
  const { data: winners = [], isLoading: loadingWinners } = useWinners();
  const { can, loading: loadingPerms } = usePermissions();
  const isLoading = loadingActions || loadingPerms || loadingWinners;

  const canFinancial = can(PERMISSIONS.FINANCEIRO_VER_DASHBOARD);
  const canCreateAction = can(PERMISSIONS.ACAO_CRIAR);

  const operationalActions = actions.filter(a => a.status !== 'archived');
  const activeActions = operationalActions.filter(a => a.status === 'active');
  const planningActions = operationalActions.filter(a => a.status === 'planning');
  const completedActions = operationalActions.filter(a => a.status === 'completed');

  // Previsão — ações ativas
  const activeRevenue = activeActions.reduce((s, a) => s + a.expectedRevenue, 0);
  const activePrizes = activeActions.reduce((s, a) => s + a.totalPrizes, 0);
  const activeMargin = activeRevenue > 0 ? ((activeRevenue - activePrizes) / activeRevenue) * 100 : 0;

  // Resultado — ações encerradas
  const completedRevenue = completedActions.reduce((s, a) => s + a.expectedRevenue, 0);
  const completedPaid = completedActions.reduce((s, a) => s + a.realPaid, 0);
  const completedProfit = completedActions.reduce((s, a) => s + a.grossProfit, 0);

  // Operação — contagens por status dos winners
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    winners.forEach(w => { counts[w.status] = (counts[w.status] || 0) + 1; });
    return counts;
  }, [winners]);

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
        subtitle="Visão financeira e operacional"
        actions={
          canCreateAction ? (
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
        {canFinancial && (
          <>
            {/* ═══ BLOCO AÇÕES ═══ */}
            <DashboardBlock title="Ações" icon={Megaphone}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniCard label="Em Planejamento" value={String(planningActions.length)} variant="default" />
                <MiniCard label="Ativas" value={String(activeActions.length)} variant="primary" />
                <MiniCard label="Encerradas" value={String(completedActions.length)} variant="success" />
              </div>

              {/* Ações recentes */}
              <div className="rounded-xl border bg-card p-4 lg:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Ações Recentes</h3>
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
            </DashboardBlock>

            {/* ═══ BLOCO PREVISÃO ═══ */}
            <DashboardBlock title="Previsão (Ações Ativas)" icon={TrendingUp}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniCard label="Faturamento Previsto" value={formatCurrency(activeRevenue)} variant="primary" />
                <MiniCard label="Premiação Prevista" value={formatCurrency(activePrizes)} variant="warning" />
                <MiniCard label="Margem Estimada" value={formatPercent(activeMargin)} variant="success" />
              </div>
            </DashboardBlock>

            {/* ═══ BLOCO RESULTADO ═══ */}
            <DashboardBlock title="Resultado (Ações Encerradas)" icon={DollarSign}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniCard label="Faturamento Real" value={formatCurrency(completedRevenue)} variant="primary" />
                <MiniCard label="Premiações Pagas" value={formatCurrency(completedPaid)} variant="warning" />
                <MiniCard label="Resultado Bruto" value={formatCurrency(completedProfit)} variant="success" />
              </div>
            </DashboardBlock>

            <div className="border-t border-border" />
          </>
        )}

        {/* ═══ BLOCO OPERAÇÃO ═══ */}
        <DashboardBlock title="Operação" icon={Users}>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <MiniCard label="Aguardando PIX" value={String(statusCounts['awaiting_pix'] || 0)} variant="warning" />
            <MiniCard label="PIX Recebido" value={String(statusCounts['pix_received'] || 0)} variant="primary" />
            <MiniCard label="Enviados p/ Lote" value={String(statusCounts['sent_to_batch'] || 0)} variant="default" />
            <MiniCard label="Pagos" value={String(statusCounts['paid'] || 0)} variant="success" />
            <MiniCard label="Comp. Enviados" value={String(statusCounts['receipt_sent'] || 0)} variant="success" />
          </div>
        </DashboardBlock>

        {/* Full operational dashboard below */}
        <OperationalDashboard />
      </div>
    </AppLayout>
  );
};

export default Index;
