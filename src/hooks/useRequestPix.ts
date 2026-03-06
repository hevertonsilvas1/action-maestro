import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Winner } from '@/types';

interface RequestPixResult {
  winner_id: string;
  success: boolean;
  error?: string;
}

export function useRequestPix(actionId: string, actionName: string) {
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const requestPix = async (winners: Winner[]): Promise<RequestPixResult[]> => {
    setIsPending(true);
    try {
      const payload = winners.map((w) => ({
        winner_id: w.id,
        winner_name: w.name,
        winner_phone: w.phoneE164 || (w.phone || '').replace(/\D/g, ''),
        action_id: actionId,
        action_name: actionName,
        prize_type: w.prizeType,
        prize_title: w.prizeTitle,
        prize_value: w.value,
      }));

      const { data, error } = await supabase.functions.invoke('request-pix', {
        body: { winners: payload },
      });

      if (error) throw error;

      const results: RequestPixResult[] = data?.results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (successCount > 0) {
        toast.success(`Pix solicitado com sucesso para ${successCount} ganhador(es).`);
      }
      if (failCount > 0) {
        toast.error(`Falha ao solicitar Pix para ${failCount} ganhador(es).`);
      }

      // Refresh winners data
      await queryClient.invalidateQueries({ queryKey: ['winners', actionId] });
      await queryClient.invalidateQueries({ queryKey: ['winners', 'all'] });

      return results;
    } catch (err) {
      console.error('Request PIX error:', err);
      toast.error('Erro ao solicitar Pix. Tente novamente.');
      return [];
    } finally {
      setIsPending(false);
    }
  };

  return { requestPix, isPending };
}
