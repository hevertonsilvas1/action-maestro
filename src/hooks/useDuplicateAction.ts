import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCreateAction, PrizeInput, CostInput } from './useCreateAction';
import { toast } from 'sonner';

export function useDuplicateAction() {
  const navigate = useNavigate();
  const createAction = useCreateAction();

  const duplicate = async (actionId: string) => {
    // Fetch the action
    const { data: action, error: actionError } = await supabase
      .from('actions')
      .select('*')
      .eq('id', actionId)
      .single();
    if (actionError || !action) throw actionError || new Error('Ação não encontrada');

    // Fetch prizes
    const { data: prizes = [] } = await supabase
      .from('prizes')
      .select('*')
      .eq('action_id', actionId);

    // Fetch costs
    const { data: costs = [] } = await supabase
      .from('costs')
      .select('*')
      .eq('action_id', actionId);

    const prizesInput: PrizeInput[] = (prizes ?? []).map((p) => ({
      prizeTypeConfigId: p.prize_type_config_id || '',
      title: p.title,
      description: p.description || undefined,
      quantity: p.quantity,
      unitValue: Number(p.unit_value),
      totalValue: p.quantity * Number(p.unit_value),
    }));

    const costsInput: CostInput[] = (costs ?? []).map((c) => ({
      costTypeConfigId: c.cost_type_config_id || '',
      description: c.description,
      quantity: c.quantity,
      unitValue: Number(c.unit_value),
      value: c.quantity * Number(c.unit_value),
    }));

    const result = await createAction.mutateAsync({
      name: `${action.name} - CÓPIA`,
      status: 'planning',
      quotaCount: action.quota_count,
      quotaValue: Number(action.quota_value),
      startDate: null,
      endDate: null,
      taxPercent: Number(action.tax_percent),
      prizes: prizesInput,
      costs: costsInput,
    });

    toast.success('Ação duplicada com sucesso!');
    navigate(`/actions/${result.id}/edit`);
    return result;
  };

  return { duplicate, isPending: createAction.isPending };
}
