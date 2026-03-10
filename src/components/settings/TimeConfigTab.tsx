import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useStatusTimeConfig, useUpdateStatusTimeConfig } from '@/hooks/useStatusTimeConfig';
import { useStatusTimeRules, useCreateStatusTimeRule, useUpdateStatusTimeRule, useDeleteStatusTimeRule, type StatusTimeRule } from '@/hooks/useStatusTimeRules';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Clock, Zap, Plus, Trash2, Pencil } from 'lucide-react';

export function TimeConfigTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: config, isLoading: configLoading } = useStatusTimeConfig();
  const updateConfig = useUpdateStatusTimeConfig();
  const { data: rules = [], isLoading: rulesLoading } = useStatusTimeRules();
  const createRule = useCreateStatusTimeRule();
  const updateRule = useUpdateStatusTimeRule();
  const deleteRule = useDeleteStatusTimeRule();
  const { activeOrdered } = useWinnerStatusMap();

  const [warningMin, setWarningMin] = useState<string>('');
  const [criticalMin, setCriticalMin] = useState<string>('');
  const [configDirty, setConfigDirty] = useState(false);

  // Rule dialog
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<StatusTimeRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    from_status: '',
    to_status: '',
    time_limit: '',
    time_unit: 'minutes',
    condition_description: '',
    is_active: true,
  });

  // Initialize local values when config loads
  const warnVal = configDirty ? warningMin : (config?.warning_minutes?.toString() ?? '10');
  const critVal = configDirty ? criticalMin : (config?.critical_minutes?.toString() ?? '30');

  const handleSaveConfig = async () => {
    const w = parseInt(warnVal);
    const c = parseInt(critVal);
    if (isNaN(w) || isNaN(c) || w <= 0 || c <= 0 || w >= c) {
      toast({ title: 'Valores inválidos', description: 'O tempo de atenção deve ser menor que o tempo crítico.', variant: 'destructive' });
      return;
    }
    try {
      await updateConfig.mutateAsync({ warning_minutes: w, critical_minutes: c, updated_by: user?.id });
      toast({ title: 'Limites de tempo atualizados!' });
      setConfigDirty(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({ name: '', from_status: '', to_status: '', time_limit: '', time_unit: 'minutes', condition_description: '', is_active: true });
    setRuleDialogOpen(true);
  };

  const openEditRule = (r: StatusTimeRule) => {
    setEditingRule(r);
    setRuleForm({
      name: r.name,
      from_status: r.from_status,
      to_status: r.to_status,
      time_limit: r.time_limit.toString(),
      time_unit: r.time_unit,
      condition_description: r.condition_description || '',
      is_active: r.is_active,
    });
    setRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!ruleForm.name || !ruleForm.from_status || !ruleForm.to_status || !ruleForm.time_limit) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    try {
      if (editingRule) {
        await updateRule.mutateAsync({
          id: editingRule.id,
          name: ruleForm.name,
          from_status: ruleForm.from_status,
          to_status: ruleForm.to_status,
          time_limit: parseInt(ruleForm.time_limit),
          time_unit: ruleForm.time_unit,
          condition_description: ruleForm.condition_description || null,
          is_active: ruleForm.is_active,
        });
        toast({ title: 'Regra atualizada!' });
      } else {
        await createRule.mutateAsync({
          name: ruleForm.name,
          from_status: ruleForm.from_status,
          to_status: ruleForm.to_status,
          time_limit: parseInt(ruleForm.time_limit),
          time_unit: ruleForm.time_unit,
          condition_description: ruleForm.condition_description || null,
          condition_field: null,
          is_active: ruleForm.is_active,
          created_by: user?.id || null,
        });
        toast({ title: 'Regra criada!' });
      }
      setRuleDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleToggleRule = async (r: StatusTimeRule) => {
    try {
      await updateRule.mutateAsync({ id: r.id, is_active: !r.is_active });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRule.mutateAsync(id);
      toast({ title: 'Regra excluída' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const getStatusName = (slug: string) => activeOrdered.find(s => s.slug === slug)?.name || slug;
  const getStatusColor = (slug: string) => activeOrdered.find(s => s.slug === slug)?.color || '#6b7280';

  if (configLoading || rulesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Threshold Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Limites de Tempo no Status</CardTitle>
              <CardDescription>Defina os limites que determinam os alertas visuais na tabela de ganhadores</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
                Normal (verde)
              </Label>
              <p className="text-[11px] text-muted-foreground">Até o limite de atenção</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                Atenção (amarelo)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={warnVal}
                  onChange={(e) => { setWarningMin(e.target.value); setConfigDirty(true); }}
                  className="w-24 text-center font-mono"
                />
                <span className="text-xs text-muted-foreground">minutos</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                Crítico (vermelho)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={critVal}
                  onChange={(e) => { setCriticalMin(e.target.value); setConfigDirty(true); }}
                  className="w-24 text-center font-mono"
                />
                <span className="text-xs text-muted-foreground">minutos</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveConfig}
              disabled={!configDirty || updateConfig.isPending}
              className="gap-1.5"
            >
              {updateConfig.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Time-based Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Regras Automáticas por Tempo</CardTitle>
                <CardDescription>Configure ações automáticas quando um ganhador ficar tempo demais em um status</CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={openCreateRule} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Nova Regra
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
              Nenhuma regra automática configurada.
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Switch checked={r.is_active} onCheckedChange={() => handleToggleRule(r)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Se ficar{' '}
                      <span className="font-semibold">{r.time_limit} {r.time_unit === 'minutes' ? 'min' : 'h'}</span>
                      {' '}em{' '}
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(r.from_status) }} />
                        {getStatusName(r.from_status)}
                      </span>
                      {' '}→{' '}
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(r.to_status) }} />
                        {getStatusName(r.to_status)}
                      </span>
                    </p>
                    {r.condition_description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 italic">Condição: {r.condition_description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteRule(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra Automática'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da regra *</Label>
              <Input value={ruleForm.name} onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Sem resposta após 30min" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status monitorado *</Label>
                <Select value={ruleForm.from_status} onValueChange={v => setRuleForm(f => ({ ...f, from_status: v }))}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {activeOrdered.map(s => (
                      <SelectItem key={s.slug} value={s.slug}>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status de destino *</Label>
                <Select value={ruleForm.to_status} onValueChange={v => setRuleForm(f => ({ ...f, to_status: v }))}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {activeOrdered.map(s => (
                      <SelectItem key={s.slug} value={s.slug}>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tempo limite *</Label>
                <Input type="number" min={1} value={ruleForm.time_limit} onChange={e => setRuleForm(f => ({ ...f, time_limit: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidade</Label>
                <Select value={ruleForm.time_unit} onValueChange={v => setRuleForm(f => ({ ...f, time_unit: v }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Condição / descrição</Label>
              <Input value={ruleForm.condition_description} onChange={e => setRuleForm(f => ({ ...f, condition_description: e.target.value }))} placeholder="Ex: Se a chave PIX não for recebida" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={ruleForm.is_active} onCheckedChange={v => setRuleForm(f => ({ ...f, is_active: v }))} />
              <Label className="text-xs">{ruleForm.is_active ? 'Ativa' : 'Inativa'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRuleDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveRule} disabled={createRule.isPending || updateRule.isPending}>
              {(createRule.isPending || updateRule.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {editingRule ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
