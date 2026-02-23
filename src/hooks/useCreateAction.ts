import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PrizeInput {
  prizeTypeConfigId: string;
  title: string;
  description?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
}

export interface CostInput {
  costTypeConfigId: string;
  description: string;
  quantity: number;
  unitValue: number;
  value: number;
}

export interface CreateActionInput {
  name: string;
  status: 'planning' | 'active' | 'completed';
  quotaCount: number;
  quotaValue: number;
  startDate?: string | null;
  endDate?: string | null;
  taxPercent: number;
  prizes: PrizeInput[];
  costs: CostInput[];
}

export function useCreateAction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateActionInput) => {
      const expectedRevenue = input.quotaCount * input.quotaValue;
      const totalPrizes = input.prizes.reduce((s, p) => s + p.totalValue, 0);
      const totalCostsRaw = input.costs.reduce((s, c) => s + c.value, 0);
      const taxValue = (input.taxPercent / 100) * expectedRevenue;
      const totalCost = totalPrizes + totalCostsRaw + taxValue;
      const grossProfit = expectedRevenue - totalCost;
      const marginPercent = expectedRevenue > 0 ? (grossProfit / expectedRevenue) * 100 : 0;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert action
      const { data: action, error: actionError } = await supabase
        .from('actions')
        .insert({
          name: input.name,
          status: input.status,
          quota_count: input.quotaCount,
          quota_value: input.quotaValue,
          start_date: input.startDate || null,
          end_date: input.endDate || null,
          tax_percent: input.taxPercent,
          expected_revenue: expectedRevenue,
          total_prizes: totalPrizes,
          total_operational: totalCostsRaw,
          total_taxes: taxValue,
          total_cost: totalCost,
          gross_profit: grossProfit,
          margin_percent: marginPercent,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (actionError) throw actionError;

      // Insert prizes
      if (input.prizes.length > 0) {
        const { error: prizesError } = await supabase.from('prizes').insert(
          input.prizes.map((p) => ({
            action_id: action.id,
            prize_type_config_id: p.prizeTypeConfigId,
            title: p.title,
            description: p.description || null,
            type: 'main' as const, // keep enum compatibility
            quantity: p.quantity,
            unit_value: p.unitValue,
            total_value: p.totalValue,
          }))
        );
        if (prizesError) throw prizesError;
      }

      // Insert costs
      if (input.costs.length > 0) {
        const { error: costsError } = await supabase.from('costs').insert(
          input.costs.map((c) => ({
            action_id: action.id,
            cost_type_config_id: c.costTypeConfigId,
            description: c.description,
            category: 'other' as const, // keep enum compatibility
            quantity: c.quantity,
            unit_value: c.unitValue,
            value: c.value,
          }))
        );
        if (costsError) throw costsError;
      }

      // Audit log
      await supabase.from('action_audit_log').insert({
        action_id: action.id,
        table_name: 'actions',
        record_id: action.id,
        operation: 'create',
        changes: { name: input.name, status: input.status, prizes: input.prizes.length, costs: input.costs.length },
        user_id: user?.id || null,
      });

      return action;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actions'] });
    },
  });
}
