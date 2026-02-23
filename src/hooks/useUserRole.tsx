import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { UserRole } from '@/types';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching role:', error);
        setRole(null);
      } else {
        setRole((data?.role as UserRole) ?? null);
      }
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  const isAdmin = role === 'admin';
  const isSupport = role === 'support';

  return { role, isAdmin, isSupport, loading };
}
