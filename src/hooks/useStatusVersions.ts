import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StatusVersion {
  id: string;
  status_id: string;
  version: number;
  update_mode: string;
  trigger_event: string | null;
  is_active: boolean;
  created_at: string;
}

export function useStatusVersions() {
  return useQuery({
    queryKey: ['winner_status_versions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('winner_status_versions' as any)
        .select('*')
        .order('version', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as StatusVersion[];
    },
  });
}
