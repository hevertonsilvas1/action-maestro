import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';

export interface StatusHistoryEntry {
  id: string;
  winner_id: string;
  from_status_id: string | null;
  to_status_id: string;
  change_type: string;
  trigger_event: string | null;
  changed_by_user_id: string | null;
  changed_by_name: string | null;
  notes: string | null;
  created_at: string;
}

export function useStatusHistory(winnerId: string | null) {
  return useQuery({
    queryKey: ['winner_status_history', winnerId],
    queryFn: async () => {
      if (!winnerId) return [];
      const { data, error } = await supabase
        .from('winner_status_history' as any)
        .select('*')
        .eq('winner_id', winnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as StatusHistoryEntry[];
    },
    enabled: !!winnerId,
  });
}
