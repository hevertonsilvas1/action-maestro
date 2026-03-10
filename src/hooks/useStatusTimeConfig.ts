import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StatusTimeConfig {
  id: string;
  warning_minutes: number;
  critical_minutes: number;
  updated_at: string;
  updated_by: string | null;
}

export function useStatusTimeConfig() {
  return useQuery({
    queryKey: ['status_time_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('status_time_config' as any)
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as unknown as StatusTimeConfig;
    },
  });
}

export function useUpdateStatusTimeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { warning_minutes: number; critical_minutes: number; updated_by?: string }) => {
      // Get existing config id
      const { data: existing } = await supabase
        .from('status_time_config' as any)
        .select('id')
        .limit(1)
        .single();
      if (!existing) throw new Error('Config not found');
      const { error } = await supabase
        .from('status_time_config' as any)
        .update({ ...values, updated_at: new Date().toISOString() } as any)
        .eq('id', (existing as any).id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status_time_config'] }),
  });
}
