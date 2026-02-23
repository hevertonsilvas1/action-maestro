import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeleteValidation {
  canDelete: boolean;
  reason?: string;
}

export async function validateActionDeletion(actionId: string): Promise<DeleteValidation> {
  // Check action status
  const { data: action, error: actionError } = await supabase
    .from('actions')
    .select('status, name')
    .eq('id', actionId)
    .single();

  if (actionError || !action) {
    return { canDelete: false, reason: 'Ação não encontrada.' };
  }

  if (action.status !== 'planning') {
    return { canDelete: false, reason: `Não é possível excluir: a ação está com status "${action.status === 'active' ? 'Ativa' : action.status === 'completed' ? 'Concluída' : 'Cancelada'}". Somente ações em Planejamento podem ser excluídas.` };
  }

  // Check winners
  const { count: winnersCount } = await supabase
    .from('winners')
    .select('id', { count: 'exact', head: true })
    .eq('action_id', actionId);

  if (winnersCount && winnersCount > 0) {
    return { canDelete: false, reason: `Não é possível excluir: existem ${winnersCount} ganhador(es) vinculado(s).` };
  }

  return { canDelete: true };
}

export function useDeleteAction() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (actionId: string) => {
      const validation = await validateActionDeletion(actionId);
      if (!validation.canDelete) {
        throw new Error(validation.reason);
      }

      // Delete costs
      const { error: costsError } = await supabase
        .from('costs')
        .delete()
        .eq('action_id', actionId);
      if (costsError) throw costsError;

      // Delete prizes
      const { error: prizesError } = await supabase
        .from('prizes')
        .delete()
        .eq('action_id', actionId);
      if (prizesError) throw prizesError;

      // Delete audit log
      const { error: auditError } = await supabase
        .from('action_audit_log')
        .delete()
        .eq('action_id', actionId);
      if (auditError) throw auditError;

      // Delete action
      const { error: actionError } = await supabase
        .from('actions')
        .delete()
        .eq('id', actionId);
      if (actionError) throw actionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      toast.success('Ação excluída com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao excluir ação.');
    },
  });

  return {
    deleteAction: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
