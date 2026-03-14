import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface QuickFilter {
  id: string;
  filter_type: string;
  filter_value: string;
  sort_order: number;
}

export function useQuickFilters() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['quick-filters', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_quick_filters' as any)
        .select('id, filter_type, filter_value, sort_order')
        .eq('user_id', user!.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as QuickFilter[];
    },
  });

  const saveFilters = useMutation({
    mutationFn: async (filters: { filter_type: string; filter_value: string }[]) => {
      if (!user) return;
      // Delete all existing
      await supabase
        .from('user_quick_filters' as any)
        .delete()
        .eq('user_id', user.id);

      if (filters.length === 0) return;

      // Insert new
      const rows = filters.map((f, i) => ({
        user_id: user.id,
        filter_type: f.filter_type,
        filter_value: f.filter_value,
        sort_order: i,
      }));

      const { error } = await supabase
        .from('user_quick_filters' as any)
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-filters'] });
    },
  });

  return {
    filters: query.data ?? [],
    isLoading: query.isLoading,
    saveFilters,
  };
}
