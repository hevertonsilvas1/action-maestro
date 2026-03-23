import { useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { OperationalDashboard } from '@/components/operational/OperationalDashboard';
import { useWinners } from '@/hooks/useWinners';
import { Users, Wallet, Loader2 } from 'lucide-react';

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

export default function SupportDashboard() {
  const { data: winners = [], isLoading } = useWinners();

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
        title="Dashboard Operacional"
        subtitle="Visão geral da fila de trabalho e acompanhamento de ganhadores"
      />
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-8">
        {/* ═══ BLOCO GANHADORES ═══ */}
        <DashboardBlock title="Ganhadores" icon={Users}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniCard label="Aguardando PIX" value={String(statusCounts['awaiting_pix'] || 0)} variant="warning" />
            <MiniCard label="Cliente não Responde" value={String(statusCounts['cliente_nao_responde'] || 0)} variant="destructive" />
            <MiniCard label="Forçar PIX" value={String(statusCounts['forcar_pix'] || 0)} variant="warning" />
            <MiniCard label="PIX Recebido" value={String(statusCounts['pix_received'] || 0)} variant="primary" />
          </div>
        </DashboardBlock>

        {/* ═══ BLOCO PAGAMENTOS ═══ */}
        <DashboardBlock title="Pagamentos" icon={Wallet}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniCard label="Prontos p/ Pagamento" value={String(statusCounts['ready_to_pay'] || 0)} variant="primary" />
            <MiniCard label="Enviados p/ Lote" value={String(statusCounts['sent_to_batch'] || 0)} variant="default" />
            <MiniCard label="Pagos" value={String(statusCounts['paid'] || 0)} variant="success" />
            <MiniCard label="Comp. Enviado" value={String(statusCounts['receipt_sent'] || 0)} variant="success" />
          </div>
        </DashboardBlock>

        {/* Full operational table */}
        <OperationalDashboard />
      </div>
    </AppLayout>
  );
}
