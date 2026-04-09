import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Winner } from '@/types';

function mapWinner(row: any): Winner {
  return {
    id: row.id,
    actionId: row.action_id,
    actionName: row.actions?.name ?? undefined,
    name: row.name,
    prizeType: row.prize_type,
    prizeTitle: row.prize_title,
    value: Number(row.value),
    status: row.winner_statuses?.slug ?? row.status,
    pixKey: row.pix_key ?? undefined,
    pixType: row.pix_type ?? undefined,
    fullName: row.full_name ?? undefined,
    receiptUrl: row.receipt_url ?? undefined,
    receiptFilename: row.receipt_filename ?? undefined,
    receiptAttachedAt: row.receipt_attached_at ?? undefined,
    receiptAttachedBy: row.receipt_attached_by ?? undefined,
    receiptSentAt: row.receipt_sent_at ?? undefined,
    receiptVersion: row.receipt_version ?? 0,
    cpf: row.cpf ?? undefined,
    phone: row.phone ?? undefined,
    phoneE164: row.phone_e164 ?? undefined,
    prizeDatetime: row.prize_datetime ?? undefined,
    lastPixRequestAt: row.last_pix_request_at ?? undefined,
    lastPixError: row.last_pix_error ?? undefined,
    lastPixRequestedBy: row.last_pix_requested_by ?? undefined,
    pixHolderName: row.pix_holder_name ?? undefined,
    pixHolderDoc: row.pix_holder_doc ?? undefined,
    pixObservation: row.pix_observation ?? undefined,
    pixRegisteredBy: row.pix_registered_by ?? undefined,
    pixRegisteredAt: row.pix_registered_at ?? undefined,
    pixValidatedBy: row.pix_validated_by ?? undefined,
    pixValidatedAt: row.pix_validated_at ?? undefined,
    batchId: row.batch_id ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    ultimaInteracaoWhatsapp: row.ultima_interacao_whatsapp ?? undefined,
    lastOutboundAt: row.last_outbound_at ?? undefined,
    lastInboundAt: row.last_inbound_at ?? undefined,
    templateReopenSentAt: row.template_reopen_sent_at ?? undefined,
    templateReopenCount: row.template_reopen_count ?? 0,
    createdAt: row.created_at,
  };
}

export function useWinners(actionId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('winners-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'winners' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['winners'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['winners', actionId ?? 'all'],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let offset = 0;

      while (true) {
        let query = supabase
          .from('winners')
          .select('*, winner_statuses!winners_status_id_fkey(slug), actions!winners_action_id_fkey(name)')
          .is('deleted_at', null)
          .order('prize_datetime', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (actionId) query = query.eq('action_id', actionId);
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      return allData.map(mapWinner);
    },
  });
}
