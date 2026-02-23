import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Cost } from '@/types';

function mapCost(row: any): Cost {
  return {
    id: row.id,
    actionId: row.action_id,
    category: row.category,
    description: row.description,
    value: Number(row.value),
  };
}

export function useCosts(actionId: string) {
  return useQuery({
    queryKey: ['costs', actionId],
    enabled: !!actionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('costs')
        .select('*')
        .eq('action_id', actionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapCost);
    },
  });
}
