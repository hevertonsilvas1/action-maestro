import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a map of winnerId -> milliseconds in current status.
 * Based on the most recent entry in winner_status_history per winner.
 */
export function useTimeInStatus(winnerIds: string[]) {
  return useQuery({
    queryKey: ['time_in_status', winnerIds.sort().join(',')],
    queryFn: async () => {
      if (winnerIds.length === 0) return {} as Record<string, number>;

      // Fetch latest history entry per winner
      const { data, error } = await supabase
        .from('winner_status_history' as any)
        .select('winner_id, created_at')
        .in('winner_id', winnerIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = Date.now();
      const result: Record<string, number> = {};

      // Get the most recent entry per winner
      (data || []).forEach((row: any) => {
        if (!result[row.winner_id]) {
          result[row.winner_id] = now - new Date(row.created_at).getTime();
        }
      });

      return result;
    },
    enabled: winnerIds.length > 0,
    refetchInterval: 60000, // refresh every minute
  });
}

export function formatDuration(ms: number): string {
  if (ms < 0) return '—';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '< 1min';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}min`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ${hours % 24}h`;
  return `${days}d`;
}

export function getDurationVariant(ms: number): 'normal' | 'warning' | 'critical' {
  const hours = ms / 3600000;
  if (hours > 48) return 'critical';
  if (hours > 24) return 'warning';
  return 'normal';
}
