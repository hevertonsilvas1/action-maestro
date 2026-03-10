import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WinnerStatusConfig {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  update_mode: 'manual' | 'automatic';
  trigger_event: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ['winner_statuses'];

export function useWinnerStatuses() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('winner_statuses' as any)
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as WinnerStatusConfig[];
    },
  });
}

export function useCreateWinnerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<WinnerStatusConfig, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('winner_statuses' as any)
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as WinnerStatusConfig;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateWinnerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WinnerStatusConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from('winner_statuses' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as WinnerStatusConfig;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteWinnerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('winner_statuses' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// ── Transitions ──

export interface StatusTransition {
  id: string;
  from_status_id: string;
  to_status_id: string;
}

const TRANSITIONS_KEY = ['winner_status_transitions'];

export function useStatusTransitions() {
  return useQuery({
    queryKey: TRANSITIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('winner_status_transitions' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as StatusTransition[];
    },
  });
}

export function useSaveTransitions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fromStatusId, toStatusIds }: { fromStatusId: string; toStatusIds: string[] }) => {
      // Delete existing transitions for this source status
      const { error: delError } = await supabase
        .from('winner_status_transitions' as any)
        .delete()
        .eq('from_status_id', fromStatusId);
      if (delError) throw delError;

      // Insert new transitions
      if (toStatusIds.length > 0) {
        const rows = toStatusIds.map(toId => ({
          from_status_id: fromStatusId,
          to_status_id: toId,
        }));
        const { error: insError } = await supabase
          .from('winner_status_transitions' as any)
          .insert(rows as any);
        if (insError) throw insError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TRANSITIONS_KEY }),
  });
}
