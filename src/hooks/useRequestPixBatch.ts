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

/**
 * Like useRequestPix but works with winners from multiple actions.
 * Uses each winner's own actionId + the actionsMap for action names.
 */
export function useRequestPixBatch(actionsMap: Record<string, string>) {
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const requestPix = async (winners: Winner[]): Promise<RequestPixResult[]> => {
    setIsPending(true);
    try {
      const payload = winners.map((w) => ({
        winner_id: w.id,
        winner_name: w.name,
        winner_phone: w.phoneE164 || (w.phone || '').replace(/\D/g, ''),
        action_id: w.actionId,
        action_name: actionsMap[w.actionId] ?? '',
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

      // Refresh all winners data
      await queryClient.invalidateQueries({ queryKey: ['winners'] });

      return results;
    } catch (err) {
      console.error('Request PIX batch error:', err);
      toast.error('Erro ao solicitar Pix. Tente novamente.');
      return [];
    } finally {
      setIsPending(false);
    }
  };

  return { requestPix, isPending };
}
