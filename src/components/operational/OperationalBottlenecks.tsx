import { Winner } from '@/types';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  winners: Winner[];
  timeInStatus: Record<string, number>;
}

export function OperationalBottlenecks({ winners, timeInStatus }: Props) {
  const errorStatuses = ['pix_refused', 'numero_inexistente', 'cliente_nao_responde'];
  const manualReviewStatuses = ['receipt_attached', 'pix_received'];

  const errorCount = winners.filter(w => errorStatuses.includes(w.status)).length;
  const manualCount = winners.filter(w => manualReviewStatuses.includes(w.status)).length;

  // Winners stuck >48h
  const stuckCount = Object.values(timeInStatus).filter(ms => ms > 48 * 3600000).length;
  // Winners stuck >24h
  const warningCount = Object.values(timeInStatus).filter(ms => ms > 24 * 3600000 && ms <= 48 * 3600000).length;

  const alerts = [
    stuckCount > 0 && {
      label: `${stuckCount} ganhador${stuckCount > 1 ? 'es' : ''} parado${stuckCount > 1 ? 's' : ''} há mais de 48h`,
      variant: 'critical' as const,
      icon: Clock,
    },
    warningCount > 0 && {
      label: `${warningCount} ganhador${warningCount > 1 ? 'es' : ''} parado${warningCount > 1 ? 's' : ''} há mais de 24h`,
      variant: 'warning' as const,
      icon: Clock,
    },
    errorCount > 0 && {
      label: `${errorCount} ganhador${errorCount > 1 ? 'es' : ''} com erro`,
      variant: 'critical' as const,
      icon: XCircle,
    },
    manualCount > 0 && {
      label: `${manualCount} ganhador${manualCount > 1 ? 'es' : ''} aguardando análise manual`,
      variant: 'warning' as const,
      icon: AlertTriangle,
    },
  ].filter(Boolean) as { label: string; variant: 'critical' | 'warning'; icon: typeof Clock }[];

  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium',
            alert.variant === 'critical'
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'border-warning/30 bg-warning/5 text-warning',
          )}
        >
          <alert.icon className="h-3.5 w-3.5 shrink-0" />
          {alert.label}
        </div>
      ))}
    </div>
  );
}
