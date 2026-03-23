import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePixValidationEnabled() {
  return useQuery({
    queryKey: ['pix-validation-enabled'],
    queryFn: async () => {
      const { data } = await supabase
        .from('integration_configs')
        .select('value')
        .eq('key', 'PIX_VALIDATION_ENABLED')
        .maybeSingle();
      return data?.value === 'true';
    },
    staleTime: 60_000,
  });
}
