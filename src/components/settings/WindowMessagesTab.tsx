import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Loader2, Link2, Link2Off, Zap, Copy, Play, Settings2, ArrowRightLeft, DollarSign, ChevronDown, ChevronUp, Save, Search, CheckCircle2, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { Constants } from '@/integrations/supabase/types';

/* ───────── constants ───────── */

const MESSAGE_TYPES = [
  { value: 'solicitar_pix', label: 'Solicitar PIX', description: 'Enviar solicitação de dados PIX ao ganhador' },
  { value: 'enviar_comprovante', label: 'Enviar Comprovante', description: 'Enviar comprovante de pagamento ao ganhador' },
  { value: 'abertura_janela', label: 'Abertura de janela', description: 'Iniciar ou reabrir conversa operacional' },
  { value: 'abrir_janela', label: 'Abrir janela', description: 'Estimular resposta quando janela está fechada' },
  { value: 'prolongar_janela', label: 'Prolongar janela', description: 'Manter conversa ativa para estender janela' },
];

const TYPE_LABEL_MAP: Record<string, string> = {
  solicitar_pix: 'Solicitar PIX',
  enviar_comprovante: 'Enviar Comprovante',
  abertura_janela: 'Abertura de janela',
  abrir_janela: 'Abrir janela',
  prolongar_janela: 'Prolongar janela',
};

const SCOPE_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'action', label: 'Ação específica' },
  { value: 'prize_type', label: 'Tipo de prêmio' },
  { value: 'operational_context', label: 'Contexto operacional' },
];

const SCOPE_LABEL_MAP: Record<string, string> = {
  global: 'Global',
  action: 'Ação específica',
  prize_type: 'Tipo de prêmio',
  operational_context: 'Contexto operacional',
};

const PRIZE_TYPE_OPTIONS = Constants.public.Enums.prize_type.map((t) => ({
  value: t,
  label: t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' '),
}));

const OPERATIONAL_CONTEXT_OPTIONS = [
  { value: 'pagamento_pendente', label: 'Pagamento pendente' },
  { value: 'comprovante_pendente', label: 'Comprovante pendente' },
  { value: 'cliente_nao_respondeu', label: 'Cliente não respondeu' },
  { value: 'pix_recusado', label: 'PIX recusado' },
  { value: 'numero_inexistente', label: 'Número inexistente' },
  { value: 'janela_fechada', label: 'Janela fechada' },
  { value: 'aguardando_chave_pix', label: 'Aguardando chave PIX' },
];

const PAYLOAD_PREVIEW = `{
  "nome": "João",
  "tel": "5573999999999",
  "acao": "153 - Corolla Altis + 100 mil",
  "tipo_premio": "Giro da Sorte",
  "valor": 200,
  "receipt_url": "https://seusistema.com/storage/comprovante.pdf"
}`;

/* ───────── types ───────── */

interface WindowMessage {
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
  min_value: number | null;
  max_value: number | null;
  created_at: string;
  updated_at: string;
}

interface FormData {
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
  min_value: number | null;
  max_value: number | null;
}

interface TestAutomationResult {
  success: boolean;
  url_called?: string;
  http_method?: string;
  payload_sent?: Record<string, unknown>;
  status_code?: number;
  status_text?: string;
  response_body?: string;
  error?: string;
}

const emptyForm: FormData = {
  name: '',
  type: 'abertura_janela',
  unnichat_trigger_url: '',
  is_active: true,
  auto_use: false,
  usage_condition: null,
  trigger_rule: null,
  notes: null,
  scope: 'global',
  scope_value: null,
  priority: 1,
  min_value: null,
  max_value: null,
};

/* ───────── Resolution Simulator ───────── */

function ResolutionSimulator({ messages, actions, getScopeLabel }: {
  messages: WindowMessage[];
  actions: { id: string; name: string }[] | undefined;
  getScopeLabel: (msg: WindowMessage) => string;
}) {
  const [simType, setSimType] = useState<string>('solicitar_pix');
  const [simValue, setSimValue] = useState<string>('');
  const [simScope, setSimScope] = useState<string>('global');
  const [simScopeValue, setSimScopeValue] = useState<string>('');
  const [simResult, setSimResult] = useState<WindowMessage | null | undefined>(undefined);

  const runSimulation = () => {
    const prizeValue = simValue ? Number(simValue) : undefined;
    const candidates = messages.filter(m => m.type === simType && m.is_active);
    if (candidates.length === 0) { setSimResult(null); return; }

    const sorted = [...candidates].sort((a, b) => a.priority - b.priority);

    const matchesValue = (m: WindowMessage): boolean => {
      if (prizeValue == null) return true;
      if (m.min_value == null && m.max_value == null) return true;
      if (m.min_value != null && prizeValue < m.min_value) return false;
      if (m.max_value != null && prizeValue > m.max_value) return false;
      return true;
    };

    if (simScope === 'action' && simScopeValue) {
      const match = sorted.find(m => m.scope === 'action' && m.scope_value === simScopeValue && matchesValue(m));
      if (match) { setSimResult(match); return; }
    }
    if (simScope === 'prize_type' && simScopeValue) {
      const match = sorted.find(m => m.scope === 'prize_type' && m.scope_value === simScopeValue && matchesValue(m));
      if (match) { setSimResult(match); return; }
    }
    if (simScope === 'operational_context' && simScopeValue) {
      const match = sorted.find(m => m.scope === 'operational_context' && m.scope_value === simScopeValue && matchesValue(m));
      if (match) { setSimResult(match); return; }
    }

    const globalValue = sorted.find(m => m.scope === 'global' && (m.min_value != null || m.max_value != null) && matchesValue(m));
    if (globalValue) { setSimResult(globalValue); return; }

    const globalUniversal = sorted.find(m => m.scope === 'global' && m.min_value == null && m.max_value == null);
    setSimResult(globalUniversal || sorted[0] || null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Search className="h-4 w-4" />
          Simulador de Resolução
        </CardTitle>
        <CardDescription>
          Teste qual automação seria acionada para um determinado tipo, valor e escopo — sem disparar nada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={simType} onValueChange={(v) => { setSimType(v); setSimResult(undefined); }}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESSAGE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Valor do prêmio (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={simValue}
              onChange={(e) => { setSimValue(e.target.value); setSimResult(undefined); }}
              placeholder="Ex: 250"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Escopo</Label>
            <Select value={simScope} onValueChange={(v) => { setSimScope(v); setSimScopeValue(''); setSimResult(undefined); }}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {simScope === 'action' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ação</Label>
              <Select value={simScopeValue} onValueChange={(v) => { setSimScopeValue(v); setSimResult(undefined); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  {(actions || []).map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {simScope === 'prize_type' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de prêmio</Label>
              <Select value={simScopeValue} onValueChange={(v) => { setSimScopeValue(v); setSimResult(undefined); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  {PRIZE_TYPE_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {simScope === 'operational_context' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Contexto</Label>
              <Select value={simScopeValue} onValueChange={(v) => { setSimScopeValue(v); setSimResult(undefined); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  {OPERATIONAL_CONTEXT_OPTIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button size="sm" className="gap-1.5" onClick={runSimulation}>
          <Search className="h-3.5 w-3.5" />
          Simular
        </Button>

        {simResult !== undefined && (
          <div className={`rounded-lg border p-4 ${simResult ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
            {simResult ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium">Automação resolvida</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Nome:</span>{' '}
                    <span className="font-medium">{simResult.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Escopo:</span>{' '}
                    <span className="font-medium">{getScopeLabel(simResult)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prioridade:</span>{' '}
                    <Badge variant="secondary" className="text-xs font-mono">{simResult.priority}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Faixa:</span>{' '}
                    <span className="font-medium">
                      {simResult.min_value != null || simResult.max_value != null
                        ? `${simResult.min_value != null ? `≥ ${formatCurrency(simResult.min_value)}` : ''}${simResult.min_value != null && simResult.max_value != null ? ' e ' : ''}${simResult.max_value != null ? `≤ ${formatCurrency(simResult.max_value)}` : ''}`
                        : 'Universal'}
                    </span>
                  </div>
                </div>
                <div className="text-xs mt-1">
                  <span className="text-muted-foreground">URL:</span>{' '}
                  <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded break-all">{simResult.unnichat_trigger_url}</code>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Nenhuma automação ativa encontrada para esses parâmetros.</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────── component ───────── */

export function WindowMessagesTab() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<WindowMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });

  // Test modal
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestAutomationResult | null>(null);

  // Inline quick-edit
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState<{
    min_value: number | null;
    max_value: number | null;
    unnichat_trigger_url: string;
    scope: string;
    scope_value: string | null;
  }>({ min_value: null, max_value: null, unnichat_trigger_url: '', scope: 'global', scope_value: null });
  const [quickSaving, setQuickSaving] = useState(false);

  const openQuickEdit = (msg: WindowMessage) => {
    if (quickEditId === msg.id) {
      setQuickEditId(null);
      return;
    }
    setQuickEditId(msg.id);
    setQuickForm({
      min_value: msg.min_value,
      max_value: msg.max_value,
      unnichat_trigger_url: msg.unnichat_trigger_url,
      scope: msg.scope,
      scope_value: msg.scope_value,
    });
  };

  const handleQuickSave = async () => {
    if (!quickEditId) return;
    setQuickSaving(true);
    const { error } = await supabase
      .from('window_messages')
      .update({
        min_value: quickForm.min_value,
        max_value: quickForm.max_value,
        unnichat_trigger_url: quickForm.unnichat_trigger_url.trim(),
        scope: quickForm.scope,
        scope_value: quickForm.scope === 'global' ? null : (quickForm.scope_value?.trim() || null),
      } as any)
      .eq('id', quickEditId);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Automação atualizada' });
      setQuickEditId(null);
      fetchMessages();
    }
    setQuickSaving(false);
  };

  const { data: actions } = useQuery({
    queryKey: ['actions-list-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('actions').select('id, name').order('name');
      return data || [];
    },
  });

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('window_messages')
      .select('id, name, type, unnichat_trigger_url, is_active, auto_use, usage_condition, trigger_rule, notes, scope, scope_value, priority, min_value, max_value, created_at, updated_at')
      .order('type')
      .order('priority')
      .order('name');
    if (error) {
      toast({ title: 'Erro ao carregar automações', description: error.message, variant: 'destructive' });
    } else {
      setMessages((data as unknown as WindowMessage[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMessages(); }, []);

  /* ── CRUD ── */

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (msg: WindowMessage) => {
    setEditingId(msg.id);
    setForm({
      name: msg.name,
      type: msg.type,
      unnichat_trigger_url: msg.unnichat_trigger_url,
      is_active: msg.is_active,
      auto_use: msg.auto_use,
      usage_condition: msg.usage_condition,
      trigger_rule: msg.trigger_rule,
      notes: msg.notes,
      scope: msg.scope,
      scope_value: msg.scope_value,
      priority: msg.priority,
      min_value: msg.min_value,
      max_value: msg.max_value,
    });
    setDialogOpen(true);
  };

  const openDuplicate = (msg: WindowMessage) => {
    setEditingId(null);
    setForm({
      name: `${msg.name} (cópia)`,
      type: msg.type,
      unnichat_trigger_url: msg.unnichat_trigger_url,
      is_active: false,
      auto_use: msg.auto_use,
      usage_condition: msg.usage_condition,
      trigger_rule: msg.trigger_rule,
      notes: msg.notes,
      scope: msg.scope,
      scope_value: msg.scope_value,
      priority: msg.priority,
      min_value: msg.min_value,
      max_value: msg.max_value,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.unnichat_trigger_url.trim()) {
      toast({ title: 'Preencha os campos obrigatórios', description: 'Nome e URL de acionamento são obrigatórios.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      content: '',
      unnichat_trigger_url: form.unnichat_trigger_url.trim(),
      is_active: form.is_active,
      allow_variables: false,
      auto_use: form.auto_use,
      usage_condition: form.usage_condition?.trim() || null,
      trigger_rule: form.trigger_rule?.trim() || null,
      notes: form.notes?.trim() || null,
      scope: form.scope,
      scope_value: form.scope === 'global' ? null : (form.scope_value?.trim() || null),
      priority: form.priority,
      min_value: form.min_value,
      max_value: form.max_value,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('window_messages').update(payload as any).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('window_messages').insert(payload as any));
    }

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingId ? 'Automação atualizada' : 'Automação criada' });
      setDialogOpen(false);
      fetchMessages();
    }
    setSaving(false);
  };

  const toggleActive = async (msg: WindowMessage) => {
    const { error } = await supabase
      .from('window_messages')
      .update({ is_active: !msg.is_active } as any)
      .eq('id', msg.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      fetchMessages();
    }
  };

  /* ── Test automation ── */

  const openTest = (msg: WindowMessage) => {
    setTestingId(msg.id);
    setTestPhone('');
    setTestResult(null);
    setTestDialogOpen(true);
  };

  const normalizePhoneForAutomation = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  };

  const handleTest = async () => {
    const msg = messages.find(m => m.id === testingId);
    if (!msg || !testPhone.trim()) return;

    const payload = {
      nome: 'Teste',
      tel: normalizePhoneForAutomation(testPhone),
      acao: 'Ação de teste',
      tipo_premio: 'Giro da Sorte',
      valor: 200,
      receipt_url: 'https://seusistema.com/storage/comprovante.pdf',
    };

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-webhook', {
        body: { url: msg.unnichat_trigger_url, payload },
      });

      if (error) {
        setTestResult({
          success: false,
          url_called: msg.unnichat_trigger_url,
          http_method: 'POST',
          payload_sent: payload,
          error: error.message,
        });
        toast({ title: 'Erro ao testar', description: error.message, variant: 'destructive' });
        return;
      }

      const result = (data || {}) as TestAutomationResult;
      const finalResult: TestAutomationResult = {
        success: !!result.success,
        url_called: result.url_called || msg.unnichat_trigger_url,
        http_method: result.http_method || 'POST',
        payload_sent: result.payload_sent || payload,
        status_code: result.status_code,
        status_text: result.status_text,
        response_body: result.response_body,
        error: result.error,
      };

      setTestResult(finalResult);

      if (finalResult.success) {
        toast({ title: '✅ Teste enviado', description: `Status ${finalResult.status_code ?? 200}` });
      } else {
        toast({
          title: 'Erro na automação',
          description: finalResult.error || finalResult.response_body || `Status ${finalResult.status_code ?? 'desconhecido'}`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      const message = err?.message || 'Erro desconhecido';
      setTestResult({
        success: false,
        url_called: msg.unnichat_trigger_url,
        http_method: 'POST',
        payload_sent: payload,
        error: message,
      });
      toast({ title: 'Erro ao testar', description: message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  /* ── Helpers ── */

  const getScopeLabel = (msg: WindowMessage) => {
    let label = '';
    if (msg.scope === 'global') label = 'Global';
    else if (msg.scope === 'action' && msg.scope_value) {
      const action = actions?.find((a: any) => a.id === msg.scope_value);
      label = action ? `Ação: ${action.name}` : 'Ação específica';
    } else if (msg.scope === 'prize_type' && msg.scope_value) {
      label = `Prêmio: ${msg.scope_value.replace(/_/g, ' ')}`;
    } else if (msg.scope === 'operational_context' && msg.scope_value) {
      const ctx = OPERATIONAL_CONTEXT_OPTIONS.find(o => o.value === msg.scope_value);
      label = ctx ? ctx.label : msg.scope_value;
    } else {
      label = SCOPE_LABEL_MAP[msg.scope] || msg.scope;
    }

    // Append value range info
    if (msg.min_value != null || msg.max_value != null) {
      const parts: string[] = [];
      if (msg.min_value != null) parts.push(`≥ R$${msg.min_value}`);
      if (msg.max_value != null) parts.push(`≤ R$${msg.max_value}`);
      label += ` (${parts.join(' e ')})`;
    }

    return label;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Automações de Janela
            </CardTitle>
            <CardDescription>
              Gerencie os gatilhos de automação vinculados ao UnniChat. O conteúdo das mensagens é configurado diretamente na plataforma de automação — aqui você controla quando e como cada gatilho é acionado.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova automação
          </Button>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma automação cadastrada. Clique em "Nova automação" para começar.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead className="text-center">Prioridade</TableHead>
                    <TableHead className="text-center">Ativa</TableHead>
                    <TableHead className="text-center">Auto</TableHead>
                    <TableHead className="text-center">URL</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow key={msg.id}>
                      <TableCell className="font-medium">{msg.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABEL_MAP[msg.type] || msg.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{getScopeLabel(msg)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs font-mono">{msg.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={msg.is_active} onCheckedChange={() => toggleActive(msg)} />
                      </TableCell>
                      <TableCell className="text-center">
                        {msg.auto_use ? (
                          <Zap className="h-4 w-4 text-amber-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {msg.unnichat_trigger_url ? (
                          <Link2 className="h-4 w-4 text-emerald-500 mx-auto" />
                        ) : (
                          <Link2Off className="h-4 w-4 text-destructive mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(msg)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDuplicate(msg)} title="Duplicar">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openTest(msg)} title="Testar">
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Value routing summary ── */}
      {(() => {
        const valueRoutedTypes = ['solicitar_pix', 'enviar_comprovante'];
        const routedMessages = messages.filter(m => valueRoutedTypes.includes(m.type));
        const grouped = valueRoutedTypes.reduce<Record<string, typeof messages>>((acc, type) => {
          acc[type] = routedMessages
            .filter(m => m.type === type)
            .sort((a, b) => (a.min_value ?? -Infinity) - (b.min_value ?? -Infinity));
          return acc;
        }, {});
        const hasAny = Object.values(grouped).some(arr => arr.length > 0);

        if (!hasAny) return null;

        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Roteamento por Valor
              </CardTitle>
              <CardDescription>
                Resumo das regras de roteamento automático. Quando um PIX é solicitado, o sistema seleciona a automação correta baseado no valor do prêmio. Edite as faixas diretamente na automação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {valueRoutedTypes.map(type => {
                const items = grouped[type];
                if (!items || items.length === 0) return null;
                return (
                  <div key={type} className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {TYPE_LABEL_MAP[type] || type}
                    </p>
                    <div className="grid gap-2">
                      {items.map(msg => {
                        const hasRange = msg.min_value != null || msg.max_value != null;
                        let rangeLabel = 'Qualquer valor (universal)';
                        if (hasRange) {
                          if (msg.min_value != null && msg.max_value != null) {
                            rangeLabel = `${formatCurrency(msg.min_value)} — ${formatCurrency(msg.max_value)}`;
                          } else if (msg.min_value != null) {
                            rangeLabel = `≥ ${formatCurrency(msg.min_value)}`;
                          } else if (msg.max_value != null) {
                            rangeLabel = `≤ ${formatCurrency(msg.max_value)}`;
                          }
                        }
                        const isExpanded = quickEditId === msg.id;
                        return (
                          <div key={msg.id} className="rounded-lg border bg-muted/30 overflow-hidden transition-colors">
                            <div
                              className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => openQuickEdit(msg)}
                              title="Clique para edição rápida"
                            >
                              <div className="flex items-center gap-3">
                                <DollarSign className="h-4 w-4 text-emerald-500 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium">{msg.name}</p>
                                  <p className="text-xs text-muted-foreground">{getScopeLabel(msg).replace(/ \(.*\)/, '')}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={hasRange ? 'default' : 'secondary'} className="text-xs">
                                  {rangeLabel}
                                </Badge>
                                <Badge variant={msg.is_active ? 'default' : 'outline'} className={`text-xs ${msg.is_active ? 'bg-emerald-600' : ''}`}>
                                  {msg.is_active ? 'Ativa' : 'Inativa'}
                                </Badge>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t px-4 py-3 space-y-3 bg-background/50">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Valor mínimo (R$)</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={quickForm.min_value ?? ''}
                                      onChange={(e) => setQuickForm(prev => ({ ...prev, min_value: e.target.value ? Number(e.target.value) : null }))}
                                      placeholder="Sem mínimo"
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Valor máximo (R$)</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={quickForm.max_value ?? ''}
                                      onChange={(e) => setQuickForm(prev => ({ ...prev, max_value: e.target.value ? Number(e.target.value) : null }))}
                                      placeholder="Sem máximo"
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">URL de acionamento</Label>
                                  <Input
                                    value={quickForm.unnichat_trigger_url}
                                    onChange={(e) => setQuickForm(prev => ({ ...prev, unnichat_trigger_url: e.target.value }))}
                                    placeholder="https://..."
                                    className="h-8 text-sm font-mono"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Escopo</Label>
                                    <Select value={quickForm.scope} onValueChange={(v) => setQuickForm(prev => ({ ...prev, scope: v, scope_value: null }))}>
                                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {SCOPE_OPTIONS.map((s) => (
                                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {quickForm.scope === 'action' && (
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Ação</Label>
                                      <Select value={quickForm.scope_value || ''} onValueChange={(v) => setQuickForm(prev => ({ ...prev, scope_value: v }))}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Escolha" /></SelectTrigger>
                                        <SelectContent>
                                          {(actions || []).map((a: any) => (
                                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {quickForm.scope === 'prize_type' && (
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Tipo de prêmio</Label>
                                      <Select value={quickForm.scope_value || ''} onValueChange={(v) => setQuickForm(prev => ({ ...prev, scope_value: v }))}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Escolha" /></SelectTrigger>
                                        <SelectContent>
                                          {PRIZE_TYPE_OPTIONS.map((p) => (
                                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {quickForm.scope === 'operational_context' && (
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Contexto</Label>
                                      <Select value={quickForm.scope_value || ''} onValueChange={(v) => setQuickForm(prev => ({ ...prev, scope_value: v }))}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Escolha" /></SelectTrigger>
                                        <SelectContent>
                                          {OPERATIONAL_CONTEXT_OPTIONS.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openEdit(msg)}>
                                    <Pencil className="h-3 w-3 mr-1" />
                                    Edição completa
                                  </Button>
                                  <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setQuickEditId(null)}>
                                      Cancelar
                                    </Button>
                                    <Button size="sm" className="text-xs h-7 gap-1" onClick={handleQuickSave} disabled={quickSaving}>
                                      {quickSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                      Salvar
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Resolution simulator ── */}
      <ResolutionSimulator messages={messages} actions={actions} getScopeLabel={getScopeLabel} />

      {/* ── Payload reference ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Payload enviado nas automações</CardTitle>
          <CardDescription>
            Ao acionar um gatilho, o sistema envia automaticamente os seguintes dados operacionais via POST. Use essas variáveis para personalizar o fluxo na plataforma de automação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto font-mono">{PAYLOAD_PREVIEW}</pre>
        </CardContent>
      </Card>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar automação' : 'Nova automação'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome interno *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Abrir janela – confirmação comprovante"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESSAGE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <div>
                          <span>{t.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">— {t.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label>URL de acionamento da automação *</Label>
              <Input
                value={form.unnichat_trigger_url}
                onChange={(e) => setForm(prev => ({ ...prev, unnichat_trigger_url: e.target.value }))}
                placeholder="https://api.unnichat.com/webhook/xxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Endpoint que receberá um POST com o payload operacional quando esta automação for acionada.
              </p>
            </div>

            {/* Scope + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Escopo</Label>
                <Select value={form.scope} onValueChange={(v) => setForm(prev => ({ ...prev, scope: v, scope_value: null }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.priority}
                  onChange={(e) => setForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                  placeholder="1 = máxima"
                />
                <p className="text-xs text-muted-foreground">Menor número = maior prioridade</p>
              </div>
            </div>

            {/* Scope value selectors */}
            {form.scope === 'action' && (
              <div className="space-y-2">
                <Label>Selecionar ação</Label>
                <Select value={form.scope_value || ''} onValueChange={(v) => setForm(prev => ({ ...prev, scope_value: v }))}>
                  <SelectTrigger><SelectValue placeholder="Escolha uma ação" /></SelectTrigger>
                  <SelectContent>
                    {(actions || []).map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.scope === 'prize_type' && (
              <div className="space-y-2">
                <Label>Tipo de prêmio</Label>
                <Select value={form.scope_value || ''} onValueChange={(v) => setForm(prev => ({ ...prev, scope_value: v }))}>
                  <SelectTrigger><SelectValue placeholder="Escolha o tipo" /></SelectTrigger>
                  <SelectContent>
                    {PRIZE_TYPE_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.scope === 'operational_context' && (
              <div className="space-y-2">
                <Label>Contexto operacional</Label>
                <Select value={form.scope_value || ''} onValueChange={(v) => setForm(prev => ({ ...prev, scope_value: v }))}>
                  <SelectTrigger><SelectValue placeholder="Escolha o contexto" /></SelectTrigger>
                  <SelectContent>
                    {OPERATIONAL_CONTEXT_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Value range filter */}
            {(form.type === 'solicitar_pix' || form.type === 'enviar_comprovante') && (
              <div className="space-y-2">
                <Label>Faixa de valor do prêmio (opcional)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valor mínimo (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.min_value ?? ''}
                      onChange={(e) => setForm(prev => ({ ...prev, min_value: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="Sem mínimo"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valor máximo (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.max_value ?? ''}
                      onChange={(e) => setForm(prev => ({ ...prev, max_value: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="Sem máximo"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se preenchido, esta automação só será usada para ganhadores cujo valor do prêmio esteja dentro da faixa. Deixe vazio para aplicar a qualquer valor.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm(prev => ({ ...prev, is_active: v }))}
                />
                <Label className="cursor-pointer">Ativa</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.auto_use}
                  onCheckedChange={(v) => setForm(prev => ({ ...prev, auto_use: v }))}
                />
                <Label className="cursor-pointer">Uso automático</Label>
              </div>
            </div>

            {/* Condition + Rule */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condição de uso</Label>
                <Input
                  value={form.usage_condition || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, usage_condition: e.target.value }))}
                  placeholder="Ex: janela_fechada"
                />
              </div>
              <div className="space-y-2">
                <Label>Regra de disparo</Label>
                <Input
                  value={form.trigger_rule || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, trigger_rule: e.target.value }))}
                  placeholder="Ex: após 20h sem resposta"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações internas</Label>
              <Textarea
                value={form.notes || ''}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Anotações administrativas sobre esta automação..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Test Dialog ── */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Testar automação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Telefone de teste</Label>
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="5573999999999"
              />
              <p className="text-xs text-muted-foreground">
                O sistema envia POST com JSON plano: nome, tel, acao, tipo_premio, valor, receipt_url.
              </p>
            </div>

            {testResult && (
              <div className="space-y-2">
                <Label>Resultado do teste</Label>
                <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-xs">
                  <p><span className="font-medium">URL:</span> {testResult.url_called || '-'}</p>
                  <p><span className="font-medium">Método:</span> {testResult.http_method || 'POST'}</p>
                  <p><span className="font-medium">Status:</span> {testResult.status_code ?? '-'} {testResult.status_text || ''}</p>
                  <div>
                    <p className="font-medium mb-1">Payload enviado</p>
                    <pre className="bg-background border rounded p-2 overflow-x-auto">{JSON.stringify(testResult.payload_sent || {}, null, 2)}</pre>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Resposta do UnniChat</p>
                    <pre className="bg-background border rounded p-2 overflow-x-auto whitespace-pre-wrap">{testResult.response_body || testResult.error || '-'}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleTest} disabled={testing || !testPhone.trim()}>
              {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
