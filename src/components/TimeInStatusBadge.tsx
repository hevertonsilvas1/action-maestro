import { formatDuration, getDurationVariant, type DurationVariant } from '@/hooks/useTimeInStatus';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

// Statuses where the process is considered complete — no more time tracking
const COMPLETED_STATUSES = ['receipt_sent', 'paid'];

interface Props {
  ms: number | undefined;
  status?: string;
  warningMinutes?: number;
  criticalMinutes?: number;
  className?: string;
}

const variantStyles: Record<DurationVariant, string> = {
  normal: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive font-semibold',
};

const dotStyles: Record<DurationVariant, string> = {
  normal: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-destructive animate-pulse',
};

export function TimeInStatusBadge({ ms, status, warningMinutes = 10, criticalMinutes = 30, className }: Props) {
  if (status && COMPLETED_STATUSES.includes(status)) {
    return (
      <div className={cn('inline-flex items-center gap-1', className)}>
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        <span className="text-xs text-success">Concluído</span>
      </div>
    );
  }

  if (ms === undefined) return <span className="text-[10px] text-muted-foreground">—</span>;

  const variant = getDurationVariant(ms, warningMinutes, criticalMinutes);

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('h-2 w-2 rounded-full shrink-0', dotStyles[variant])} />
      <span className={cn('text-xs tabular-nums', variantStyles[variant])}>
        {formatDuration(ms)}
      </span>
    </div>
  );
}
