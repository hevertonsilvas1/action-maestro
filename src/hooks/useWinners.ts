import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Winner } from '@/types';

function mapWinner(row: any): Winner {
  return {
    id: row.id,
    actionId: row.action_id,
    name: row.name,
    prizeType: row.prize_type,
    prizeTitle: row.prize_title,
    value: Number(row.value),
    status: row.status,
    pixKey: row.pix_key ?? undefined,
    pixType: row.pix_type ?? undefined,
    fullName: row.full_name ?? undefined,
    receiptUrl: row.receipt_url ?? undefined,
    createdAt: row.created_at,
  };
}

export function useWinners(actionId?: string) {
  return useQuery({
    queryKey: ['winners', actionId ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('winners').select('*').order('created_at', { ascending: false });
      if (actionId) query = query.eq('action_id', actionId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapWinner);
    },
  });
}
