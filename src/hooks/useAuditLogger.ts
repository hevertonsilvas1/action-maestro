import { supabase } from '@/integrations/supabase/client';

export interface AuditLogParams {
  actionId: string;
  actionName: string;
  tableName: string;
  recordId?: string | null;
  operation: string;
  changes: Record<string, any>;
}

/**
 * Collects current user info (id, signature/name, role) and inserts an audit log entry.
 */
export async function insertAuditLog(params: AuditLogParams) {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;

  let userName: string | null = null;
  let userRole: string | null = null;

  if (userId) {
    // Fetch signature (preferred) or display_name from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('signature, display_name')
      .eq('user_id', userId)
      .maybeSingle();

    userName = profile?.signature || profile?.display_name || user?.email || null;

    // Fetch role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    userRole = roleData?.role || null;
  }

  await supabase.from('action_audit_log').insert({
    action_id: params.actionId,
    table_name: params.tableName,
    record_id: params.recordId || null,
    operation: params.operation,
    changes: params.changes,
    user_id: userId,
    user_name: userName,
    user_role: userRole,
    action_name: params.actionName,
  });
}
