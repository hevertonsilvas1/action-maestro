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
import { Plus, Pencil, Loader2, Link2, Link2Off, Variable, Zap, MessageSquare } from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';

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
];

const AVAILABLE_VARIABLES = ['{{nome}}', '{{acao}}', '{{valor}}', '{{premio}}'];

interface WindowMessage {
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
  created_at: string;
  updated_at: string;
}

type FormData = Omit<WindowMessage, 'id' | 'created_at' | 'updated_at'>;

const emptyForm: FormData = {
  name: '',
  type: 'abertura_janela',
  content: '',
  unnichat_trigger_url: '',
  is_active: true,
  allow_variables: false,
  auto_use: false,
  usage_condition: null,
  trigger_rule: null,
  notes: null,
  scope: 'global',
  scope_value: null,
  priority: 1,
};

export function WindowMessagesTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<WindowMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });

  // Load actions for scope selector
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
      .select('*')
      .order('type')
      .order('priority')
      .order('name');
    if (error) {
      toast({ title: 'Erro ao carregar mensagens', description: error.message, variant: 'destructive' });
    } else {
      setMessages((data as unknown as WindowMessage[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMessages(); }, []);

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
      content: msg.content,
      unnichat_trigger_url: msg.unnichat_trigger_url,
      is_active: msg.is_active,
      allow_variables: msg.allow_variables,
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
    if (!form.name.trim() || !form.content.trim() || !form.unnichat_trigger_url.trim()) {
      toast({ title: 'Preencha os campos obrigatórios', description: 'Nome, conteúdo e link do UnniChat são obrigatórios.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      content: form.content.trim(),
      unnichat_trigger_url: form.unnichat_trigger_url.trim(),
      is_active: form.is_active,
      allow_variables: form.allow_variables,
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
      toast({ title: editingId ? 'Mensagem atualizada' : 'Mensagem criada' });
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

  const insertVariable = (variable: string) => {
    setForm(prev => ({ ...prev, content: prev.content + variable }));
  };

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
              <MessageSquare className="h-4 w-4" />
              Mensagens de Janela
            </CardTitle>
            <CardDescription>
              Gerencie as mensagens operacionais vinculadas ao UnniChat para controle da janela de atendimento do WhatsApp.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova mensagem
          </Button>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma mensagem cadastrada. Clique em "Nova mensagem" para começar.
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
                    <TableHead className="text-center">Variáveis</TableHead>
                    <TableHead className="text-center">Link</TableHead>
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
                        <Switch
                          checked={msg.is_active}
                          onCheckedChange={() => toggleActive(msg)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {msg.auto_use ? (
                          <Zap className="h-4 w-4 text-amber-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {msg.allow_variables ? (
                          <Variable className="h-4 w-4 text-blue-500 mx-auto" />
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
                        <Button variant="ghost" size="icon" onClick={() => openEdit(msg)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar mensagem' : 'Nova mensagem'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Row 1: Name + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome interno *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Reabertura padrão"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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

            {/* Content */}
            <div className="space-y-2">
              <Label>Conteúdo da mensagem *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Digite o texto da mensagem..."
                rows={4}
              />
              {form.allow_variables && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">Variáveis:</span>
                  {AVAILABLE_VARIABLES.map((v) => (
                    <Button
                      key={v}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => insertVariable(v)}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* UnniChat URL */}
            <div className="space-y-2">
              <Label>Link de acionamento do UnniChat *</Label>
              <Input
                value={form.unnichat_trigger_url}
                onChange={(e) => setForm(prev => ({ ...prev, unnichat_trigger_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            {/* Scope + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Escopo</Label>
                <Select value={form.scope} onValueChange={(v) => setForm(prev => ({ ...prev, scope: v, scope_value: null }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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

            {/* Scope value selector */}
            {form.scope === 'action' && (
              <div className="space-y-2">
                <Label>Selecionar ação</Label>
                <Select value={form.scope_value || ''} onValueChange={(v) => setForm(prev => ({ ...prev, scope_value: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma ação" />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o tipo" />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o contexto" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATIONAL_CONTEXT_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Toggles */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm(prev => ({ ...prev, is_active: v }))}
                />
                <Label className="cursor-pointer">Ativa</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.allow_variables}
                  onCheckedChange={(v) => setForm(prev => ({ ...prev, allow_variables: v }))}
                />
                <Label className="cursor-pointer">Usa variáveis</Label>
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
                <Label>Regra/tempo de disparo</Label>
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
                placeholder="Anotações sobre esta mensagem..."
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
    </div>
  );
}
