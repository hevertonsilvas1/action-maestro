import { Winner } from '@/types';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  winners: Winner[];
  timeInStatus: Record<string, number>;
  warningMinutes?: number;
  criticalMinutes?: number;
}

export function OperationalBottlenecks({ winners, timeInStatus, warningMinutes = 10, criticalMinutes = 30 }: Props) {
  const errorStatuses = ['pix_refused', 'numero_inexistente', 'cliente_nao_responde'];
  const manualReviewStatuses = ['receipt_attached', 'pix_received'];

  const errorCount = winners.filter(w => errorStatuses.includes(w.status)).length;
  const manualCount = winners.filter(w => manualReviewStatuses.includes(w.status)).length;

  // Winners stuck beyond critical threshold
  const stuckCount = Object.values(timeInStatus).filter(ms => ms > criticalMinutes * 60000).length;
  // Winners in warning zone
  const warningCount = Object.values(timeInStatus).filter(ms => ms > warningMinutes * 60000 && ms <= criticalMinutes * 60000).length;

  const alerts = [
    stuckCount > 0 && {
      label: `${stuckCount} ganhador${stuckCount > 1 ? 'es' : ''} parado${stuckCount > 1 ? 's' : ''} há mais de ${criticalMinutes}min`,
      variant: 'critical' as const,
      icon: Clock,
    },
    warningCount > 0 && {
      label: `${warningCount} ganhador${warningCount > 1 ? 'es' : ''} parado${warningCount > 1 ? 's' : ''} há mais de ${warningMinutes}min`,
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
