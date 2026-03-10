import { useWinnerStatuses, type WinnerStatusConfig } from '@/hooks/useWinnerStatuses';
import { useMemo } from 'react';

export interface WinnerStatusMap {
  bySlug: Record<string, WinnerStatusConfig>;
  byId: Record<string, WinnerStatusConfig>;
  all: WinnerStatusConfig[];
  activeOrdered: WinnerStatusConfig[];
  isLoading: boolean;
  getLabel: (slug: string) => string;
  getColor: (slug: string) => string;
}

export function useWinnerStatusMap(): WinnerStatusMap {
  const { data: statuses, isLoading } = useWinnerStatuses();

  return useMemo(() => {
    const all = statuses || [];
    const bySlug: Record<string, WinnerStatusConfig> = {};
    const byId: Record<string, WinnerStatusConfig> = {};
    all.forEach((s) => {
      bySlug[s.slug] = s;
      byId[s.id] = s;
    });

    const activeOrdered = all.filter(s => s.is_active).sort((a, b) => a.sort_order - b.sort_order);

    const getLabel = (slug: string) => bySlug[slug]?.name || slug;
    const getColor = (slug: string) => bySlug[slug]?.color || '#6b7280';

    return { bySlug, byId, all, activeOrdered, isLoading, getLabel, getColor };
  }, [statuses, isLoading]);
}
