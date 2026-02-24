import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useWinners } from '@/hooks/useWinners';
import { formatCurrency } from '@/lib/format';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';
import { WinnerStatus, WINNER_STATUS_LABELS } from '@/types';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function SupportDashboard() {
  const { data: winners = [], isLoading } = useWinners();

  const statusCounts: Record<string, { count: number; value: number }> = {};
  winners.forEach((w) => {
    if (!statusCounts[w.status]) statusCounts[w.status] = { count: 0, value: 0 };
    statusCounts[w.status].count += 1;
    statusCounts[w.status].value += w.value;
  });

  const pending = winners.filter(w => ['imported', 'pix_requested'].includes(w.status));
  const refused = winners.filter(w => w.status === 'pix_refused');
  const inProcess = winners.filter(w => ['pix_received', 'sent_to_batch'].includes(w.status));
  const completed = winners.filter(w => ['receipt_attached', 'receipt_sent'].includes(w.status));
  const withErrors = winners.filter(w => !!w.lastPixError);

  const today = new Date().toISOString().slice(0, 10);
  const paidToday = completed.filter(w => w.createdAt?.slice(0, 10) === today).length;

  const totalValue = winners.reduce((s, w) => s + w.value, 0);
  const completedValue = completed.reduce((s, w) => s + w.value, 0);

  // Work queue: imported + pix_requested + pix_refused
  const workQueue = winners.filter(w => ['imported', 'pix_requested', 'pix_refused'].includes(w.status));

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
        title="Dashboard Operacional"
        subtitle="Visão geral de pagamentos e ganhadores"
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* KPI Cards */}
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
            icon={XCircle}
            variant="destructive"
            subtitle={formatCurrency(refused.reduce((s, w) => s + w.value, 0))}
          />
          <StatsCard
            title="Concluídos"
            value={String(completed.length)}
            icon={CheckCircle2}
            variant="success"
            subtitle={`${paidToday} hoje · ${formatCurrency(completedValue)}`}
          />
          <StatsCard
            title="Com Erros"
            value={String(withErrors.length)}
            icon={Send}
            variant="destructive"
            subtitle="Falha no último envio"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Status Pipeline with R$ values */}
          <div className="rounded-xl border bg-card p-4 lg:p-5">
            <h2 className="text-sm font-semibold mb-4">Pipeline por Status</h2>
            {winners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum ganhador registrado.</p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {Object.entries(statusCounts).map(([status, data]) => (
                    <div key={status} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
                      <StatusBadge status={status as WinnerStatus} />
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground">{formatCurrency(data.value)}</span>
                        <span className="text-sm font-semibold w-6 text-right">{data.count}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Concluídos</span>
                    <span className="text-xs font-semibold text-success">
                      {completed.length}/{winners.length} · {formatCurrency(completedValue)}
                    </span>
                  </div>
                  <Progress
                    value={winners.length > 0 ? (completed.length / winners.length) * 100 : 0}
                    className="h-2"
                  />
                </div>
              </>
            )}
          </div>

          {/* Work Queue */}
          <div className="rounded-xl border bg-card p-4 lg:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Minha Fila de Trabalho</h2>
              <Link to="/winners">
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  Ver todos
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <Link to="/winners" className="text-center p-3 rounded-lg bg-warning/5 hover:bg-warning/10 transition-colors">
                <Clock className="h-5 w-5 text-warning mx-auto mb-1.5" />
                <p className="text-lg font-bold">{pending.length}</p>
                <p className="text-[10px] text-muted-foreground">Pendente</p>
              </Link>
              <Link to="/winners" className="text-center p-3 rounded-lg bg-info/5 hover:bg-info/10 transition-colors">
                <Send className="h-5 w-5 text-info mx-auto mb-1.5" />
                <p className="text-lg font-bold">{inProcess.length}</p>
                <p className="text-[10px] text-muted-foreground">Em processo</p>
              </Link>
              <Link to="/winners" className="text-center p-3 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors">
                <XCircle className="h-5 w-5 text-destructive mx-auto mb-1.5" />
                <p className="text-lg font-bold">{refused.length}</p>
                <p className="text-[10px] text-muted-foreground">Recusado</p>
              </Link>
            </div>

            {/* Recent items needing attention */}
            {workQueue.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {workQueue.slice(0, 10).map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{w.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatCurrency(w.value)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {w.lastPixError && <AlertCircle className="h-3 w-3 text-destructive" />}
                      <StatusBadge status={w.status} />
                    </div>
                  </div>
                ))}
                {workQueue.length > 10 && (
                  <p className="text-[10px] text-center text-muted-foreground">
                    +{workQueue.length - 10} outros na fila
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">🎉 Fila vazia!</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}