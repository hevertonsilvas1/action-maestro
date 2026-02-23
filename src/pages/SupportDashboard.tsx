import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useWinners } from '@/hooks/useWinners';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { WinnerStatus } from '@/types';
import { Progress } from '@/components/ui/progress';

export default function SupportDashboard() {
  const { data: winners = [], isLoading } = useWinners();

  const statusCounts: Record<string, number> = {};
  winners.forEach((w) => {
    statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
  });

  const pending = winners.filter(w => ['imported', 'pix_requested', 'awaiting_pix'].includes(w.status)).length;
  const inProcess = winners.filter(w => ['pix_received', 'ready_to_pay', 'sent_to_batch'].includes(w.status)).length;
  const awaitingReceipt = winners.filter(w => w.status === 'awaiting_receipt').length;
  const completed = winners.filter(w => ['paid', 'receipt_sent'].includes(w.status)).length;

  // Paid today
  const today = new Date().toISOString().slice(0, 10);
  const paidToday = winners.filter(w =>
    (w.status === 'paid' || w.status === 'receipt_sent') &&
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
        title="Dashboard Operacional"
        subtitle="Visão geral de pagamentos e ganhadores"
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Pendentes"
            value={String(pending)}
            icon={Clock}
            variant="warning"
            subtitle="Aguardando Pix ou importados"
          />
          <StatsCard
            title="Em Processo"
            value={String(inProcess)}
            icon={AlertCircle}
            variant="accent"
            subtitle="Pix recebido → Enviado p/ lote"
          />
          <StatsCard
            title="Aguardando Comprovante"
            value={String(awaitingReceipt)}
            icon={Users}
            variant="primary"
          />
          <StatsCard
            title="Concluídos"
            value={String(completed)}
            icon={CheckCircle2}
            variant="success"
            subtitle={`${paidToday} pagos hoje`}
          />
        </div>

        {/* Status Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
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
                      {completed}/{winners.length}
                    </span>
                  </div>
                  <Progress
                    value={(completed / winners.length) * 100}
                    className="h-2"
                  />
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 lg:p-5">
            <h2 className="text-sm font-semibold mb-4">Resumo da Fila</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-warning/5">
                <Clock className="h-5 w-5 text-warning mx-auto mb-1.5" />
                <p className="text-lg font-bold">{pending}</p>
                <p className="text-[10px] text-muted-foreground">Pendente</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-info/5">
                <AlertCircle className="h-5 w-5 text-info mx-auto mb-1.5" />
                <p className="text-lg font-bold">{inProcess}</p>
                <p className="text-[10px] text-muted-foreground">Em processo</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-success/5">
                <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1.5" />
                <p className="text-lg font-bold">{completed}</p>
                <p className="text-[10px] text-muted-foreground">Concluído</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
