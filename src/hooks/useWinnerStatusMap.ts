import { useWinnerStatuses, useStatusTransitions, type WinnerStatusConfig } from '@/hooks/useWinnerStatuses';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TransitionMode = 'free' | 'controlled' | 'hybrid';

export interface WinnerStatusMap {
  bySlug: Record<string, WinnerStatusConfig>;
  byId: Record<string, WinnerStatusConfig>;
  all: WinnerStatusConfig[];
  activeOrdered: WinnerStatusConfig[];
  isLoading: boolean;
  transitionMode: TransitionMode;
  getLabel: (slug: string) => string;
  getColor: (slug: string) => string;
  getAllowedTransitions: (fromSlug: string, isManual?: boolean) => WinnerStatusConfig[];
}

function useTransitionMode() {
  return useQuery({
    queryKey: ['transition-mode'],
    queryFn: async () => {
      const { data } = await supabase
        .from('integration_configs')
        .select('value')
        .eq('key', 'STATUS_TRANSITION_MODE')
        .maybeSingle();
      return (data?.value as TransitionMode) || 'hybrid';
    },
    staleTime: 60_000,
  });
}

export function useWinnerStatusMap(): WinnerStatusMap {
  const { data: statuses, isLoading } = useWinnerStatuses();
  const { data: transitions } = useStatusTransitions();
  const { data: transitionMode = 'hybrid' } = useTransitionMode();

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

    const getConfiguredTransitions = (fromSlug: string): WinnerStatusConfig[] => {
      const fromStatus = bySlug[fromSlug];
      if (!fromStatus) return activeOrdered;
      const allowed = transMap[fromStatus.id];
      if (!allowed || allowed.length === 0) return activeOrdered.filter(s => s.slug !== fromSlug);
      return allowed.map(id => byId[id]).filter(Boolean).sort((a, b) => a.sort_order - b.sort_order);
    };

    const getAllowedTransitions = (fromSlug: string, isManual: boolean = true): WinnerStatusConfig[] => {
      // Free mode: allow all transitions
      if (transitionMode === 'free') {
        return activeOrdered.filter(s => s.slug !== fromSlug);
      }

      // Controlled mode: strict configured transitions only
      if (transitionMode === 'controlled') {
        return getConfiguredTransitions(fromSlug);
      }

      // Hybrid mode: manual changes are free, automations follow configured
      if (isManual) {
        return activeOrdered.filter(s => s.slug !== fromSlug);
      }
      return getConfiguredTransitions(fromSlug);
    };

    return { bySlug, byId, all, activeOrdered, isLoading, transitionMode, getLabel, getColor, getAllowedTransitions };
  }, [statuses, transitions, isLoading, transitionMode]);
}
