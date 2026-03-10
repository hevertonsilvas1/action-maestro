import { cn } from '@/lib/utils';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';

interface StatusBadgeProps {
  status: string;
  /** Override label (e.g. for action statuses) */
  labels?: Record<string, string>;
  /** Override color classes (e.g. for action statuses) */
  colors?: Record<string, string>;
  className?: string;
}

export function StatusBadge({ status, labels, colors, className }: StatusBadgeProps) {
  const { getLabel, getColor } = useWinnerStatusMap();

  // If custom labels/colors provided (e.g. action statuses), use them
  if (labels || colors) {
    const label = labels?.[status] ?? status;
    const color = colors?.[status] ?? 'bg-muted text-muted-foreground';
    return (
      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold', color, className)}>
        {label}
      </span>
    );
  }

  // Winner status: use dynamic DB data with inline color
  const label = getLabel(status);
  const bgColor = getColor(status);

  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white', className)}
      style={{ backgroundColor: bgColor }}
    >
      {label}
    </span>
  );
}
