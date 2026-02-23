import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Prize } from '@/types';

function mapPrize(row: any): Prize {
  return {
    id: row.id,
    actionId: row.action_id,
    type: row.type,
    title: row.title,
    quantity: row.quantity,
    unitValue: Number(row.unit_value),
    totalValue: Number(row.total_value),
  };
}

export function usePrizes(actionId: string) {
  return useQuery({
    queryKey: ['prizes', actionId],
    enabled: !!actionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prizes')
        .select('*')
        .eq('action_id', actionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapPrize);
    },
  });
}
