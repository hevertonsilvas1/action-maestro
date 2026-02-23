import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TypeConfig {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

function mapConfig(row: any): TypeConfig {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.created_at,
  };
}

export function usePrizeTypeConfigs() {
  return useQuery({
    queryKey: ['prize_type_configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prize_type_configs')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []).map(mapConfig);
    },
  });
}

export function useCostTypeConfigs() {
  return useQuery({
    queryKey: ['cost_type_configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_type_configs')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []).map(mapConfig);
    },
  });
}

export function useCreatePrizeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('prize_type_configs')
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return mapConfig(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prize_type_configs'] }),
  });
}

export function useCreateCostType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('cost_type_configs')
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return mapConfig(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost_type_configs'] }),
  });
}

export function useUpdateTypeConfig(table: 'prize_type_configs' | 'cost_type_configs') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, active }: { id: string; name?: string; active?: boolean }) => {
      const update: any = {};
      if (name !== undefined) update.name = name;
      if (active !== undefined) update.active = active;
      const { error } = await supabase.from(table).update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}
