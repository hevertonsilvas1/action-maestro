import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useForcePasswordCheck() {
  const { user, loading: authLoading } = useAuth();
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setMustChangePassword(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('force_password_change')
          .eq('user_id', user.id)
          .single();

        if (!error && data) {
          setMustChangePassword((data as any).force_password_change === true);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [user, authLoading]);

  return { mustChangePassword, loading };
}
