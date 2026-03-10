/**
 * Shared helper to fetch active window messages from the window_messages table.
 * Used by edge functions to get the correct UnniChat trigger URL and message content
 * based on message type and context.
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
}

/**
 * Fetch a single active window message by type.
 * Optionally filter by auto_use for automatic flows.
 */
export async function getWindowMessage(
  client: any,
  type: string,
  options?: { autoOnly?: boolean; usageCondition?: string }
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

  query = query.order("created_at", { ascending: true }).limit(1);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(`[WindowMessage] Error fetching type="${type}":`, error.message);
    return null;
  }

  return data as WindowMessage | null;
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
