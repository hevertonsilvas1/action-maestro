import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a map of winnerId -> milliseconds in current status.
 * Based on the most recent entry in winner_status_history per winner.
 */
export function useTimeInStatus(winnerIds: string[]) {
  const [tick, setTick] = useState(0);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return useQuery({
    queryKey: ['time_in_status', winnerIds.sort().join(',')],
    queryFn: async () => {
      if (winnerIds.length === 0) return {} as Record<string, number>;

      const { data, error } = await supabase
        .from('winner_status_history' as any)
        .select('winner_id, created_at')
        .in('winner_id', winnerIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = Date.now();
      const result: Record<string, number> = {};

      (data || []).forEach((row: any) => {
        if (!result[row.winner_id]) {
          result[row.winner_id] = now - new Date(row.created_at).getTime();
        }
      });

      return result;
    },
    enabled: winnerIds.length > 0,
    refetchInterval: 30000,
  });
}

/**
 * Client-side live timer that recalculates durations every 30s
 * without refetching from the DB. Takes the base timestamps
 * and keeps them fresh.
 */
export function useLiveTimeInStatus(baseTimeMap: Record<string, number>) {
  const [liveMap, setLiveMap] = useState(baseTimeMap);

  useEffect(() => {
    setLiveMap(baseTimeMap);
  }, [baseTimeMap]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveMap(prev => {
        const updated: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          updated[k] = v + 30000;
        }
        return updated;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return liveMap;
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

export type DurationVariant = 'normal' | 'warning' | 'critical';

export function getDurationVariant(ms: number, warningMinutes = 10, criticalMinutes = 30): DurationVariant {
  const minutes = ms / 60000;
  if (minutes >= criticalMinutes) return 'critical';
  if (minutes >= warningMinutes) return 'warning';
  return 'normal';
}
