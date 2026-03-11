/**
 * Shared helper to fetch active automation triggers from the window_messages table.
 * Used by edge functions to get the correct UnniChat trigger URL
 * based on type, scope, priority and context.
 *
 * This system is an orchestrator — it does NOT store message content.
 * The actual message text lives in the automation platform (UnniChat).
 * This helper resolves WHICH automation URL to call and builds the operational payload.
 */

export interface WindowMessage {
  id: string;
  name: string;
  type: string;
  unnichat_trigger_url: string;
  is_active: boolean;
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
 * Build the standard operational payload sent to the automation platform.
 * UnniChat espera JSON plano com estas chaves exatas.
 */
export function buildPayload(vars: {
  nome?: string;
  tel?: string;
  acao?: string;
  tipo_premio?: string;
  valor?: number | string;
  receipt_url?: string;
  // aliases legadas (mantidas para compatibilidade)
  telefone?: string;
  premio?: string;
  comprovante_url?: string;
}): Record<string, unknown> {
  const phoneDigits = String(vars.tel ?? vars.telefone ?? "").replace(/\D/g, "");
  const tel = phoneDigits
    ? (phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`)
    : "";

  const numericValue =
    typeof vars.valor === "number"
      ? vars.valor
      : Number.isFinite(Number(vars.valor))
        ? Number(vars.valor)
        : 0;

  return {
    nome: vars.nome ?? "",
    tel,
    acao: vars.acao ?? "",
    tipo_premio: vars.tipo_premio ?? vars.premio ?? "",
    valor: numericValue,
    receipt_url: vars.receipt_url ?? vars.comprovante_url ?? "",
  };
}

/**
 * Fetch the best matching active automation trigger by type, applying scope priority:
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
    .select("id, name, type, unnichat_trigger_url, is_active, auto_use, usage_condition, trigger_rule, notes, scope, scope_value, priority")
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

  const globalMatch = messages.find(m => m.scope === 'global');
  return globalMatch || messages[0];
}
