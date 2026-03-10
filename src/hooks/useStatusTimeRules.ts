import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StatusTimeRule {
  id: string;
  name: string;
  from_status: string;
  to_status: string;
  time_limit: number;
  time_unit: string;
  condition_field: string | null;
  condition_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useStatusTimeRules() {
  return useQuery({
    queryKey: ['status_time_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('status_time_rules' as any)
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as StatusTimeRule[];
    },
  });
}

export function useCreateStatusTimeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<StatusTimeRule, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('status_time_rules' as any).insert(rule as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status_time_rules'] }),
  });
}

export function useUpdateStatusTimeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<StatusTimeRule> & { id: string }) => {
      const { error } = await supabase
        .from('status_time_rules' as any)
        .update({ ...values, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status_time_rules'] }),
  });
}

export function useDeleteStatusTimeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('status_time_rules' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status_time_rules'] }),
  });
}
