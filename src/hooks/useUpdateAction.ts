import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { insertAuditLog } from './useAuditLogger';
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

      // Fetch old action + old prizes + old costs for diff
      const [{ data: oldAction }, { data: oldPrizes }, { data: oldCosts }] = await Promise.all([
        supabase.from('actions').select('*').eq('id', input.id).single(),
        supabase.from('prizes').select('*').eq('action_id', input.id),
        supabase.from('costs').select('*').eq('action_id', input.id),
      ]);

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

      // Build action field changes diff
      const actionChanges: Record<string, { before: any; after: any }> = {};
      if (oldAction) {
        const fieldMap: [string, string, string][] = [
          ['name', 'name', 'Nome'],
          ['status', 'status', 'Status'],
          ['quota_count', 'quotaCount', 'Qtd Cotas'],
          ['quota_value', 'quotaValue', 'Valor Cota'],
          ['tax_percent', 'taxPercent', 'Impostos (%)'],
          ['start_date', 'startDate', 'Data Início'],
          ['end_date', 'endDate', 'Data Fim'],
        ];
        for (const [dbKey, inputKey, label] of fieldMap) {
          const oldVal = oldAction[dbKey as keyof typeof oldAction];
          const newVal = (input as any)[inputKey];
          if (String(oldVal ?? '') !== String(newVal ?? '')) {
            actionChanges[label] = { before: oldVal, after: newVal };
          }
        }
        if (Number(oldAction.expected_revenue) !== expectedRevenue) {
          actionChanges['Receita Esperada'] = { before: oldAction.expected_revenue, after: expectedRevenue };
        }
        if (Number(oldAction.total_prizes) !== totalPrizes) {
          actionChanges['Total Premiações'] = { before: oldAction.total_prizes, after: totalPrizes };
        }
        if (Number(oldAction.total_operational) !== totalCostsRaw) {
          actionChanges['Total Custos Operacionais'] = { before: oldAction.total_operational, after: totalCostsRaw };
        }
        if (Number(oldAction.gross_profit) !== grossProfit) {
          actionChanges['Lucro Bruto'] = { before: oldAction.gross_profit, after: grossProfit };
        }
      }

      // Log action changes
      if (Object.keys(actionChanges).length > 0) {
        await insertAuditLog({
          actionId: input.id,
          actionName: input.name,
          tableName: 'actions',
          recordId: input.id,
          operation: 'update',
          changes: actionChanges,
        });
      }

      // Log prize changes
      const oldPrizesList = (oldPrizes ?? []).map(p => `${p.title} (${p.quantity}x R$${p.unit_value})`);
      const newPrizesList = input.prizes.map(p => `${p.title} (${p.quantity}x R$${p.unitValue})`);
      const prizesChanged = JSON.stringify(oldPrizesList.sort()) !== JSON.stringify(newPrizesList.sort());
      if (prizesChanged) {
        await insertAuditLog({
          actionId: input.id,
          actionName: input.name,
          tableName: 'prizes',
          operation: 'update',
          changes: {
            'Premiações anteriores': oldPrizesList.length > 0 ? oldPrizesList : ['Nenhuma'],
            'Premiações atuais': newPrizesList.length > 0 ? newPrizesList : ['Nenhuma'],
            'Total anterior': oldPrizes?.reduce((s, p) => s + Number(p.total_value), 0) ?? 0,
            'Total atual': totalPrizes,
          },
        });
      }

      // Log cost changes
      const oldCostsList = (oldCosts ?? []).map(c => `${c.description} (${c.quantity}x R$${c.unit_value})`);
      const newCostsList = input.costs.map(c => `${c.description} (${c.quantity}x R$${c.unitValue})`);
      const costsChanged = JSON.stringify(oldCostsList.sort()) !== JSON.stringify(newCostsList.sort());
      if (costsChanged) {
        await insertAuditLog({
          actionId: input.id,
          actionName: input.name,
          tableName: 'costs',
          operation: 'update',
          changes: {
            'Custos anteriores': oldCostsList.length > 0 ? oldCostsList : ['Nenhum'],
            'Custos atuais': newCostsList.length > 0 ? newCostsList : ['Nenhum'],
            'Total anterior': oldCosts?.reduce((s, c) => s + Number(c.value), 0) ?? 0,
            'Total atual': totalCostsRaw,
          },
        });
      }

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
