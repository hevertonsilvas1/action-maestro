import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Prize, Winner } from '@/types';

export interface PrizeLimitInfo {
  prizeType: string;
  title: string;
  planned: number;
  used: number;
  remaining: number;
  isExhausted: boolean;
}

/**
 * Computes prize limits from already-loaded prizes and winners arrays.
 * Returns a map of prize_type → PrizeLimitInfo and helper functions.
 */
export function usePrizeLimits(prizes: Prize[] | undefined, winners: Winner[] | undefined) {
  const limits = useMemo(() => {
    if (!prizes || !winners) return new Map<string, PrizeLimitInfo>();

    // Count active (non-deleted) winners per prize_type
    const usedByType = new Map<string, number>();
    for (const w of winners) {
      const count = usedByType.get(w.prizeType) || 0;
      usedByType.set(w.prizeType, count + 1);
    }

    const map = new Map<string, PrizeLimitInfo>();
    for (const p of prizes) {
      const existing = map.get(p.type);
      const planned = (existing?.planned || 0) + p.quantity;
      const used = usedByType.get(p.type) || 0;
      const remaining = Math.max(0, planned - used);
      map.set(p.type, {
        prizeType: p.type,
        title: existing?.title || p.title,
        planned,
        used,
        remaining,
        isExhausted: remaining <= 0,
      });
    }
    return map;
  }, [prizes, winners]);

  /** Check if adding `count` winners of `prizeType` would exceed the limit */
  const canAdd = (prizeType: string, count = 1): boolean => {
    const info = limits.get(prizeType);
    if (!info) return true; // No planned limit for this type → allow
    return info.remaining >= count;
  };

  /** Get remaining slots for a prize type. Returns Infinity if no limit configured. */
  const remainingFor = (prizeType: string): number => {
    const info = limits.get(prizeType);
    if (!info) return Infinity;
    return info.remaining;
  };

  /** Get display message for exhausted prize type */
  const exhaustedMessage = (prizeType: string): string | null => {
    const info = limits.get(prizeType);
    if (!info || !info.isExhausted) return null;
    return `Limite atingido para "${info.title}": ${info.planned} previsto(s), ${info.used} utilizado(s).`;
  };

  return { limits, canAdd, remainingFor, exhaustedMessage };
}

/**
 * Standalone function to check prize limits directly from DB.
 * Used in import flow where we don't have React context.
 */
export async function checkPrizeLimitsFromDB(
  actionId: string
): Promise<Map<string, PrizeLimitInfo>> {
  const [prizesRes, winnersRes] = await Promise.all([
    supabase.from('prizes').select('type, title, quantity').eq('action_id', actionId),
    supabase
      .from('winners')
      .select('prize_type')
      .eq('action_id', actionId)
      .is('deleted_at', null),
  ]);

  const prizes = prizesRes.data || [];
  const winners = winnersRes.data || [];

  const usedByType = new Map<string, number>();
  for (const w of winners) {
    usedByType.set(w.prize_type, (usedByType.get(w.prize_type) || 0) + 1);
  }

  const map = new Map<string, PrizeLimitInfo>();
  for (const p of prizes) {
    const existing = map.get(p.type);
    const planned = (existing?.planned || 0) + p.quantity;
    const used = usedByType.get(p.type) || 0;
    const remaining = Math.max(0, planned - used);
    map.set(p.type, {
      prizeType: p.type,
      title: existing?.title || p.title,
      planned,
      used,
      remaining,
      isExhausted: remaining <= 0,
    });
  }
  return map;
}
