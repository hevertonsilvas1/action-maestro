import { cn } from '@/lib/utils';
import { WinnerStatus, WINNER_STATUS_LABELS, WINNER_STATUS_COLORS } from '@/types';

interface StatusBadgeProps {
  status: WinnerStatus | string;
  labels?: Record<string, string>;
  colors?: Record<string, string>;
  className?: string;
}

export function StatusBadge({ status, labels, colors, className }: StatusBadgeProps) {
  const label = labels?.[status] ?? WINNER_STATUS_LABELS[status as WinnerStatus] ?? status;
  const color = colors?.[status] ?? WINNER_STATUS_COLORS[status as WinnerStatus] ?? 'bg-muted text-muted-foreground';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        color,
        className
      )}
    >
      {label}
    </span>
  );
}
