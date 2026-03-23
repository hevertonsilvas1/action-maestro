import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Action } from '@/types';

function mapAction(row: any): Action {
  const prizes = row.prizes as any[] | null;
  const plannedWinners = prizes ? prizes.reduce((s: number, p: any) => s + (p.quantity ?? 0), 0) : 0;
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    previousStatus: row.previous_status ?? null,
    quotaCount: row.quota_count ?? 0,
    quotaValue: Number(row.quota_value ?? 0),
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    taxPercent: Number(row.tax_percent ?? 0),
    expectedRevenue: Number(row.expected_revenue),
    totalPrizes: Number(row.total_prizes),
    totalOperational: Number(row.total_operational),
    totalTaxes: Number(row.total_taxes),
    totalCost: Number(row.total_cost),
    grossProfit: Number(row.gross_profit),
    marginPercent: Number(row.margin_percent),
    realPaid: Number(row.real_paid),
    winnersCount: row.winners_count,
    paidCount: row.paid_count,
    pendingCount: row.pending_count,
    plannedWinners,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useActions() {
  return useQuery({
    queryKey: ['actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actions')
        .select('*, prizes(quantity)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapAction);
    },
  });
}

export function useAction(id: string | undefined) {
  return useQuery({
    queryKey: ['actions', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actions')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapAction(data) : null;
    },
  });
}
