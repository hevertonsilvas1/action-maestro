import { formatDuration, getDurationVariant, type DurationVariant } from '@/hooks/useTimeInStatus';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface Props {
  ms: number | undefined;
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

export function TimeInStatusBadge({ ms, warningMinutes = 10, criticalMinutes = 30, className }: Props) {
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
