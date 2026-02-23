import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PrizeInput, CostInput } from './useCreateAction';

export interface UpdateActionInput {
  id: string;
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

export function useUpdateAction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateActionInput) => {
      const expectedRevenue = input.quotaCount * input.quotaValue;
      const totalPrizes = input.prizes.reduce((s, p) => s + p.totalValue, 0);
      const totalCostsRaw = input.costs.reduce((s, c) => s + c.value, 0);
      const taxValue = (input.taxPercent / 100) * expectedRevenue;
      const totalCost = totalPrizes + totalCostsRaw + taxValue;
      const grossProfit = expectedRevenue - totalCost;
      const marginPercent = expectedRevenue > 0 ? (grossProfit / expectedRevenue) * 100 : 0;

      const { data: { user } } = await supabase.auth.getUser();

      // Fetch old action for diff
      const { data: oldAction } = await supabase
        .from('actions')
        .select('*')
        .eq('id', input.id)
        .single();

      // Update action
      const { data: action, error: actionError } = await supabase
        .from('actions')
        .update({
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
        })
        .eq('id', input.id)
        .select()
        .single();

      if (actionError) throw actionError;

      // Delete existing prizes and costs, then re-insert
      await supabase.from('prizes').delete().eq('action_id', input.id);
      await supabase.from('costs').delete().eq('action_id', input.id);

      if (input.prizes.length > 0) {
        const { error: prizesError } = await supabase.from('prizes').insert(
          input.prizes.map((p) => ({
            action_id: input.id,
            prize_type_config_id: p.prizeTypeConfigId,
            title: p.title,
            description: p.description || null,
            type: 'main' as const,
            quantity: p.quantity,
            unit_value: p.unitValue,
            total_value: p.totalValue,
          }))
        );
        if (prizesError) throw prizesError;
      }

      if (input.costs.length > 0) {
        const { error: costsError } = await supabase.from('costs').insert(
          input.costs.map((c) => ({
            action_id: input.id,
            cost_type_config_id: c.costTypeConfigId,
            description: c.description,
            category: 'other' as const,
            quantity: c.quantity,
            unit_value: c.unitValue,
            value: c.value,
          }))
        );
        if (costsError) throw costsError;
      }

      // Build changes diff
      const changes: Record<string, { before: any; after: any }> = {};
      if (oldAction) {
        const fields = [
          ['name', 'name'], ['status', 'status'],
          ['quota_count', 'quotaCount'], ['quota_value', 'quotaValue'],
          ['tax_percent', 'taxPercent'], ['start_date', 'startDate'],
          ['end_date', 'endDate'],
        ] as const;
        for (const [dbKey, inputKey] of fields) {
          const oldVal = oldAction[dbKey as keyof typeof oldAction];
          const newVal = (input as any)[inputKey];
          if (String(oldVal ?? '') !== String(newVal ?? '')) {
            changes[dbKey] = { before: oldVal, after: newVal };
          }
        }
        if (Number(oldAction.expected_revenue) !== expectedRevenue) {
          changes.expected_revenue = { before: oldAction.expected_revenue, after: expectedRevenue };
        }
        if (Number(oldAction.total_prizes) !== totalPrizes) {
          changes.total_prizes = { before: oldAction.total_prizes, after: totalPrizes };
        }
        if (Number(oldAction.total_operational) !== totalCostsRaw) {
          changes.total_operational = { before: oldAction.total_operational, after: totalCostsRaw };
        }
      }

      // Audit log
      await supabase.from('action_audit_log').insert({
        action_id: input.id,
        table_name: 'actions',
        record_id: input.id,
        operation: 'update',
        changes,
        user_id: user?.id || null,
      });

      return action;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['actions'] });
      qc.invalidateQueries({ queryKey: ['actions', variables.id] });
      qc.invalidateQueries({ queryKey: ['prizes', variables.id] });
      qc.invalidateQueries({ queryKey: ['costs', variables.id] });
      qc.invalidateQueries({ queryKey: ['audit-log', variables.id] });
    },
  });
}
