import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PixBatch {
  id: string;
  actionId: string;
  actionName?: string;
  generatedAt: string;
  generatedBy: string | null;
  winnerCount: number;
  totalValue: number;
  filename: string | null;
}

export function usePixBatches(actionId?: string) {
  return useQuery({
    queryKey: ['pix_batches', actionId],
    queryFn: async () => {
      let query = supabase
        .from('pix_batches')
        .select('*, actions!pix_batches_action_id_fkey(name)')
        .order('generated_at', { ascending: false });

      if (actionId) {
        query = query.eq('action_id', actionId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((b: any) => ({
        id: b.id,
        actionId: b.action_id,
        actionName: b.actions?.name || '',
        generatedAt: b.generated_at,
        generatedBy: b.generated_by,
        winnerCount: b.winner_count,
        totalValue: b.total_value,
        filename: b.filename,
      })) as PixBatch[];
    },
  });
}
