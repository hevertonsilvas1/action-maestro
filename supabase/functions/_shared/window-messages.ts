/**
 * Shared helper to fetch active window messages from the window_messages table.
 * Used by edge functions to get the correct UnniChat trigger URL and message content
 * based on message type, scope, priority and context.
 */

export interface WindowMessage {
  id: string;
  name: string;
  type: string;
  content: string;
  unnichat_trigger_url: string;
  is_active: boolean;
  allow_variables: boolean;
  auto_use: boolean;
  usage_condition: string | null;
  trigger_rule: string | null;
  notes: string | null;
  scope: string;
  scope_value: string | null;
  priority: number;
}

export interface WindowMessageQuery {
  autoOnly?: boolean;
  usageCondition?: string;
  actionId?: string;
  prizeType?: string;
  operationalContext?: string;
}

/**
 * Fetch the best matching active window message by type, applying scope priority:
 * 1. action-specific → 2. prize_type-specific → 3. operational_context → 4. global
 * Within the same scope level, uses the lowest priority number.
 */
export async function getWindowMessage(
  client: any,
  type: string,
  options?: WindowMessageQuery
): Promise<WindowMessage | null> {
  let query = client
    .from("window_messages")
    .select("*")
    .eq("type", type)
    .eq("is_active", true);

  if (options?.autoOnly) {
    query = query.eq("auto_use", true);
  }

  if (options?.usageCondition) {
    query = query.eq("usage_condition", options.usageCondition);
  }

  query = query.order("priority", { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error(`[WindowMessage] Error fetching type="${type}":`, error.message);
    return null;
  }

  if (!data || data.length === 0) return null;

  const messages = data as WindowMessage[];

  // Apply scope priority: action > prize_type > operational_context > global
  if (options?.actionId) {
    const match = messages.find(m => m.scope === 'action' && m.scope_value === options.actionId);
    if (match) return match;
  }

  if (options?.prizeType) {
    const match = messages.find(m => m.scope === 'prize_type' && m.scope_value === options.prizeType);
    if (match) return match;
  }

  if (options?.operationalContext) {
    const match = messages.find(m => m.scope === 'operational_context' && m.scope_value === options.operationalContext);
    if (match) return match;
  }

  // Fallback to global (already sorted by priority)
  const globalMatch = messages.find(m => m.scope === 'global');
  return globalMatch || messages[0];
}

/**
 * Replace supported variables in a message content string.
 * Supported: {{nome}}, {{acao}}, {{valor}}, {{premio}}
 */
export function replaceVariables(
  content: string,
  variables: Record<string, string | undefined>
): string {
  let result = content;
  if (variables.nome) result = result.replace(/\{\{nome\}\}/g, variables.nome);
  if (variables.acao) result = result.replace(/\{\{acao\}\}/g, variables.acao);
  if (variables.valor) result = result.replace(/\{\{valor\}\}/g, variables.valor);
  if (variables.premio) result = result.replace(/\{\{premio\}\}/g, variables.premio);
  return result;
}
