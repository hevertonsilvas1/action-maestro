import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useArchiveAction() {
  const queryClient = useQueryClient();

  const archive = useMutation({
    mutationFn: async (actionId: string) => {
      // Get current status to store as previous_status
      const { data: action, error: fetchError } = await supabase
        .from('actions')
        .select('status')
        .eq('id', actionId)
        .single();
      if (fetchError || !action) throw new Error('Ação não encontrada.');

      const { error } = await supabase
        .from('actions')
        .update({ status: 'archived' as any, previous_status: action.status } as any)
        .eq('id', actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      toast.success('Ação arquivada com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao arquivar ação.');
    },
  });

  return { archive: archive.mutateAsync, isPending: archive.isPending };
}

export function useRestoreAction() {
  const queryClient = useQueryClient();

  const restore = useMutation({
    mutationFn: async (actionId: string) => {
      const { data: action, error: fetchError } = await supabase
        .from('actions')
        .select('previous_status')
        .eq('id', actionId)
        .single();
      if (fetchError || !action) throw new Error('Ação não encontrada.');

      const restoreStatus = (action as any).previous_status || 'planning';

      const { error } = await supabase
        .from('actions')
        .update({ status: restoreStatus, previous_status: null } as any)
        .eq('id', actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      toast.success('Ação restaurada com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao restaurar ação.');
    },
  });

  return { restore: restore.mutateAsync, isPending: restore.isPending };
}
