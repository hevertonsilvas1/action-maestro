import { useWinnerStatuses, useStatusTransitions, type WinnerStatusConfig } from '@/hooks/useWinnerStatuses';
import { useMemo } from 'react';

export interface WinnerStatusMap {
  bySlug: Record<string, WinnerStatusConfig>;
  byId: Record<string, WinnerStatusConfig>;
  all: WinnerStatusConfig[];
  activeOrdered: WinnerStatusConfig[];
  isLoading: boolean;
  getLabel: (slug: string) => string;
  getColor: (slug: string) => string;
  getAllowedTransitions: (fromSlug: string) => WinnerStatusConfig[];
}

export function useWinnerStatusMap(): WinnerStatusMap {
  const { data: statuses, isLoading } = useWinnerStatuses();
  const { data: transitions } = useStatusTransitions();

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

    // Build transitions map: from_status_id -> to_status_id[]
    const transMap: Record<string, string[]> = {};
    (transitions || []).forEach(t => {
      if (!transMap[t.from_status_id]) transMap[t.from_status_id] = [];
      transMap[t.from_status_id].push(t.to_status_id);
    });

    const getAllowedTransitions = (fromSlug: string): WinnerStatusConfig[] => {
      const fromStatus = bySlug[fromSlug];
      if (!fromStatus) return activeOrdered;
      const allowed = transMap[fromStatus.id];
      // If no transitions configured, allow all
      if (!allowed || allowed.length === 0) return activeOrdered.filter(s => s.slug !== fromSlug);
      return allowed.map(id => byId[id]).filter(Boolean).sort((a, b) => a.sort_order - b.sort_order);
    };

    return { bySlug, byId, all, activeOrdered, isLoading, getLabel, getColor, getAllowedTransitions };
  }, [statuses, transitions, isLoading]);
}
