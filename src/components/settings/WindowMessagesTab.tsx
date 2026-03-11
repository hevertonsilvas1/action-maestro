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
import { Plus, Pencil, Loader2, Link2, Link2Off, Zap, Copy, Play, Settings2 } from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';

/* ───────── constants ───────── */

const MESSAGE_TYPES = [
  { value: 'abertura_janela', label: 'Abertura de janela', description: 'Iniciar ou reabrir conversa operacional' },
  { value: 'abrir_janela', label: 'Abrir janela', description: 'Estimular resposta quando janela está fechada' },
  { value: 'prolongar_janela', label: 'Prolongar janela', description: 'Manter conversa ativa para estender janela' },
];

const TYPE_LABEL_MAP: Record<string, string> = {
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
  "telefone": "5573999999999",
  "acao": "153 - Corolla Altis + 100 mil",
  "valor": 200,
  "premio": "Giro da Sorte",
  "ganhador_id": "uuid",
  "action_id": "uuid"
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
};

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
      .select('id, name, type, unnichat_trigger_url, is_active, auto_use, usage_condition, trigger_rule, notes, scope, scope_value, priority, created_at, updated_at')
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
    setTestDialogOpen(true);
  };

  const handleTest = async () => {
    const msg = messages.find(m => m.id === testingId);
    if (!msg || !testPhone.trim()) return;
    setTesting(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(msg.unnichat_trigger_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: 'Teste',
          telefone: testPhone.replace(/\D/g, ''),
          acao: 'Ação de teste',
          valor: 0,
          premio: 'Teste',
          ganhador_id: '00000000-0000-0000-0000-000000000000',
          action_id: '00000000-0000-0000-0000-000000000000',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        toast({ title: 'Teste enviado', description: `Status ${res.status} — Verifique no UnniChat.` });
      } else {
        toast({ title: 'Resposta inesperada', description: `Status ${res.status} ${res.statusText}`, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao testar', description: err.name === 'AbortError' ? 'Timeout: sem resposta em 10s' : err.message, variant: 'destructive' });
    }

    setTesting(false);
    setTestDialogOpen(false);
  };

  /* ── Helpers ── */

  const getScopeLabel = (msg: WindowMessage) => {
    if (msg.scope === 'global') return 'Global';
    if (msg.scope === 'action' && msg.scope_value) {
      const action = actions?.find((a: any) => a.id === msg.scope_value);
      return action ? `Ação: ${action.name}` : 'Ação específica';
    }
    if (msg.scope === 'prize_type' && msg.scope_value) {
      return `Prêmio: ${msg.scope_value.replace(/_/g, ' ')}`;
    }
    if (msg.scope === 'operational_context' && msg.scope_value) {
      const ctx = OPERATIONAL_CONTEXT_OPTIONS.find(o => o.value === msg.scope_value);
      return ctx ? ctx.label : msg.scope_value;
    }
    return SCOPE_LABEL_MAP[msg.scope] || msg.scope;
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

            {/* Toggles */}
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
                O sistema enviará um POST de teste para a URL configurada com dados fictícios.
              </p>
            </div>
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
