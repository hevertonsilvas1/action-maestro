import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditLogEntry {
  id: string;
  actionId: string;
  actionName: string | null;
  tableName: string;
  recordId: string | null;
  operation: string;
  changes: Record<string, any> | null;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  createdAt: string;
}

export function useAuditLog(actionId: string | undefined) {
  return useQuery({
    queryKey: ['audit-log', actionId],
    enabled: !!actionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_audit_log')
        .select('*')
        .eq('action_id', actionId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row): AuditLogEntry => ({
        id: row.id,
        actionId: row.action_id,
        actionName: (row as any).action_name ?? null,
        tableName: row.table_name,
        recordId: row.record_id,
        operation: row.operation,
        changes: row.changes as Record<string, any> | null,
        userId: row.user_id,
        userName: (row as any).user_name ?? null,
        userRole: (row as any).user_role ?? null,
        createdAt: row.created_at,
      }));
    },
  });
}
