import { Link } from 'react-router-dom';
import { Winner } from '@/types';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';
import {
  LucideIcon, Users, Send, CheckCircle2, FileText, XCircle, Paperclip,
  AlertTriangle, Clock, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_ICONS: Record<string, LucideIcon> = {
  imported: FileText,
  pix_requested: Send,
  awaiting_pix: Clock,
  pix_received: CheckCircle2,
  ready_to_pay: CheckCircle2,
  sent_to_batch: FileText,
  paid: CheckCircle2,
  receipt_attached: Paperclip,
  receipt_sent: CheckCircle2,
  pix_refused: XCircle,
  numero_inexistente: AlertTriangle,
  cliente_nao_responde: AlertTriangle,
  awaiting_receipt: Eye,
};

interface Props {
  winners: Winner[];
  onStatusClick: (status: string) => void;
}

export function OperationalSummaryCards({ winners, onStatusClick }: Props) {
  const { activeOrdered } = useWinnerStatusMap();

  const statusCounts: Record<string, number> = {};
  winners.forEach(w => {
    statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
  });

  const errorStatuses = ['pix_refused', 'numero_inexistente', 'cliente_nao_responde'];
  const errorCount = errorStatuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0);

  return (
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total Ganhadores"
          value={winners.length}
          icon={Users}
          variant="default"
          onClick={() => onStatusClick('all')}
        />
        <KpiCard
          label="Com Erro"
          value={errorCount}
          icon={XCircle}
          variant={errorCount > 0 ? 'destructive' : 'default'}
          onClick={() => onStatusClick('error')}
        />
        <KpiCard
          label="Pagos"
          value={statusCounts['paid'] || 0}
          icon={CheckCircle2}
          variant="success"
          onClick={() => onStatusClick('paid')}
        />
        <KpiCard
          label="Comp. Enviado"
          value={statusCounts['receipt_sent'] || 0}
          icon={Send}
          variant="success"
          onClick={() => onStatusClick('receipt_sent')}
        />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {activeOrdered.map(s => {
          const Icon = STATUS_ICONS[s.slug] || FileText;
          const count = statusCounts[s.slug] || 0;
          return (
            <button
              key={s.slug}
              onClick={() => onStatusClick(s.slug)}
              className="rounded-xl border bg-card p-3 transition-all hover:shadow-card-hover hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2.5 text-left"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${s.color}20` }}
              >
                <Icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none">{count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.name}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, variant, onClick }: {
  label: string; value: number; icon: LucideIcon; variant: 'default' | 'destructive' | 'success'; onClick: () => void;
}) {
  const styles = {
    default: 'border-border bg-card',
    destructive: 'border-destructive/30 bg-destructive/5',
    success: 'border-success/30 bg-success/5',
  };
  const iconStyles = {
    default: 'text-muted-foreground',
    destructive: 'text-destructive',
    success: 'text-success',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 lg:p-4 transition-all hover:shadow-card-hover hover:scale-[1.02] active:scale-[0.98] text-left',
        styles[variant],
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', iconStyles[variant])} />
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </button>
  );
}
