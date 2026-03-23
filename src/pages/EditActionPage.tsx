import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { useAction } from '@/hooks/useActions';
import { usePrizes } from '@/hooks/usePrizes';
import { useCosts } from '@/hooks/useCosts';
import { usePrizeTypeConfigs, useCostTypeConfigs, useCreatePrizeType, useCreateCostType } from '@/hooks/useTypeConfigs';
import { useUpdateAction } from '@/hooks/useUpdateAction';
import { useCreateAction, PrizeInput, CostInput } from '@/hooks/useCreateAction';
import { useDuplicateAction } from '@/hooks/useDuplicateAction';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatCurrency, formatPercent, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Plus, Trash2, Loader2, AlertTriangle, Save, Copy, History, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useFormDraft } from '@/hooks/useFormDraft';
import { DraftBanner, DraftStatusIndicator } from '@/components/DraftBanner';

const QUOTA_OPTIONS_POPULAR = [1000, 10000, 100000, 10000000];
const QUOTA_OPTIONS = [
  10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100, 150, 200, 250, 300, 350, 400, 450, 500,
  550, 600, 650, 700, 750, 800, 850, 900, 950,
  1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
  20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000,
  400000, 500000, 1000000, 2000000, 3000000, 4000000, 5000000, 10000000,
];

function fmtQuota(n: number) {
  return n.toLocaleString('pt-BR');
}

export default function EditActionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, loading: roleLoading } = usePermissions();
  const isAdmin = can(PERMISSIONS.ACAO_EDITAR);
  const { data: action, isLoading: actionLoading } = useAction(id);
  const { data: existingPrizes = [], isLoading: prizesLoading } = usePrizes(id ?? '');
  const { data: existingCosts = [], isLoading: costsLoading } = useCosts(id ?? '');
  const { data: prizeTypes = [], isLoading: ptLoading } = usePrizeTypeConfigs();
  const { data: costTypes = [], isLoading: ctLoading } = useCostTypeConfigs();
  const { data: auditLog = [] } = useAuditLog(id);
  const createPrizeType = useCreatePrizeType();
  const createCostType = useCreateCostType();
  const updateAction = useUpdateAction();
  const createAction = useCreateAction();
  const { duplicate: duplicateAction, isPending: isDuplicating } = useDuplicateAction();

  // Form state
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'planning' | 'active' | 'completed'>('planning');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quotaCount, setQuotaCount] = useState<number | null>(null);
  const [quotaValue, setQuotaValue] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [prizes, setPrizes] = useState<Array<{
    typeConfigId: string; title: string; description: string; quantity: string; unitValue: string;
  }>>([]);
  const [costs, setCosts] = useState<Array<{
    typeConfigId: string; description: string; quantity: string; unitValue: string;
  }>>([]);

  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showNegativeProfitAlert, setShowNegativeProfitAlert] = useState(false);
  const [showActiveWarning, setShowActiveWarning] = useState(false);
  const [showNewPrizeType, setShowNewPrizeType] = useState(false);
  const [showNewCostType, setShowNewCostType] = useState(false);
  const [newPrizeTypeName, setNewPrizeTypeName] = useState('');
  const [newCostTypeName, setNewCostTypeName] = useState('');

  // Auto-save draft
  const formData = useMemo(() => ({ name, status, startDate, endDate, quotaCount, quotaValue, taxPercent, prizes, costs }), [name, status, startDate, endDate, quotaCount, quotaValue, taxPercent, prizes, costs]);
  const { draft, clearDraft, discardDraft, clearAfterSave, draftStatus } = useFormDraft({ key: `edit-action-${id}`, data: formData, enabled: initialized });

  const restoreDraft = useCallback(() => {
    if (!draft) return;
    setName(draft.name || '');
    setStatus(draft.status || 'planning');
    setStartDate(draft.startDate || '');
    setEndDate(draft.endDate || '');
    setQuotaCount(draft.quotaCount ?? null);
    setQuotaValue(draft.quotaValue || '');
    setTaxPercent(draft.taxPercent || '');
    setPrizes(draft.prizes || []);
    setCosts(draft.costs || []);
    clearDraft();
    toast.success('Rascunho restaurado!');
  }, [draft, clearDraft]);

  // Populate form from loaded data
  useEffect(() => {
    if (action && !initialized && !prizesLoading && !costsLoading) {
      setName(action.name);
      setStatus(action.status as any);
      setStartDate((action as any).startDate || '');
      setEndDate((action as any).endDate || '');
      setQuotaCount(action.quotaCount);
      setQuotaValue(String(action.quotaValue));
      setTaxPercent(String((action as any).taxPercent ?? 0));
      setPrizes(existingPrizes.map(p => ({
        typeConfigId: (p as any).prizeTypeConfigId || '',
        title: p.title,
        description: (p as any).description || '',
        quantity: String(p.quantity),
        unitValue: String(p.unitValue),
      })));
      setCosts(existingCosts.map(c => ({
        typeConfigId: (c as any).costTypeConfigId || '',
        description: c.description,
        quantity: String((c as any).quantity || 1),
        unitValue: String((c as any).unitValue || c.value),
      })));
      setInitialized(true);
    }
  }, [action, existingPrizes, existingCosts, initialized, prizesLoading, costsLoading]);

  // Calculations
  const quotaValueNum = parseFloat(quotaValue) || 0;
  const expectedRevenue = (quotaCount ?? 0) * quotaValueNum;
  const taxPercentNum = parseFloat(taxPercent) || 0;
  const taxValue = (taxPercentNum / 100) * expectedRevenue;
  const totalPrizes = useMemo(() =>
    prizes.reduce((s, p) => s + (parseFloat(p.quantity) || 0) * (parseFloat(p.unitValue) || 0), 0),
    [prizes]
  );
  const totalCosts = useMemo(() =>
    costs.reduce((s, c) => s + (parseFloat(c.quantity) || 0) * (parseFloat(c.unitValue) || 0), 0),
    [costs]
  );
  const totalPlannedCost = totalPrizes + totalCosts + taxValue;
  const grossProfit = expectedRevenue - totalPlannedCost;
  const marginPercent = expectedRevenue > 0 ? (grossProfit / expectedRevenue) * 100 : 0;

  const isCompleted = action?.status === 'completed';
  const isArchived = action?.status === 'archived';
  const isActive = action?.status === 'active';
  const readOnly = isCompleted || isArchived;

  const isLoading = roleLoading || actionLoading || prizesLoading || costsLoading || ptLoading || ctLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <AppHeader title="Acesso Negado" />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground">Você não tem permissão para editar ações.</p>
        </div>
      </AppLayout>
    );
  }

  if (!action) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Ação não encontrada.</p>
          <Link to="/actions"><Button variant="outline" size="sm"><ArrowLeft className="h-3.5 w-3.5 mr-1" />Voltar</Button></Link>
        </div>
      </AppLayout>
    );
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Nome é obrigatório';
    if (!quotaCount) e.quotaCount = 'Selecione a quantidade de cotas';
    if (!quotaValueNum || quotaValueNum <= 0) e.quotaValue = 'Valor da cota deve ser maior que zero';
    if (taxPercentNum < 0) e.taxPercent = 'Percentual não pode ser negativo';
    prizes.forEach((p, i) => {
      if (!p.typeConfigId) e[`prize_type_${i}`] = 'Selecione o tipo';
      if (!p.title.trim()) e[`prize_title_${i}`] = 'Título obrigatório';
      const qty = parseFloat(p.quantity);
      const uv = parseFloat(p.unitValue);
      if (!qty || qty <= 0) e[`prize_qty_${i}`] = 'Quantidade inválida';
      if (!uv || uv < 0) e[`prize_uv_${i}`] = 'Valor inválido';
    });
    costs.forEach((c, i) => {
      if (!c.typeConfigId) e[`cost_type_${i}`] = 'Selecione o tipo';
      if (!c.description.trim()) e[`cost_desc_${i}`] = 'Descrição obrigatória';
      const qty = parseFloat(c.quantity);
      const uv = parseFloat(c.unitValue);
      if (!qty || qty <= 0) e[`cost_qty_${i}`] = 'Quantidade inválida';
      if (!uv || uv < 0) e[`cost_uv_${i}`] = 'Valor inválido';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(forceNegative = false, forceActive = false) {
    if (readOnly) return;
    if (!validate()) { toast.error('Corrija os erros antes de salvar.'); return; }
    if (grossProfit < 0 && !forceNegative) { setShowNegativeProfitAlert(true); return; }
    if (isActive && !forceActive) { setShowActiveWarning(true); return; }

    const prizesInput: PrizeInput[] = prizes.map(p => ({
      prizeTypeConfigId: p.typeConfigId, title: p.title, description: p.description || undefined,
      quantity: parseInt(p.quantity), unitValue: parseFloat(p.unitValue),
      totalValue: parseInt(p.quantity) * parseFloat(p.unitValue),
    }));
    const costsInput: CostInput[] = costs.map(c => ({
      costTypeConfigId: c.typeConfigId, description: c.description,
      quantity: parseInt(c.quantity), unitValue: parseFloat(c.unitValue),
      value: parseInt(c.quantity) * parseFloat(c.unitValue),
    }));

    try {
      await updateAction.mutateAsync({
        id: id!, name: name.trim(), status, quotaCount: quotaCount!, quotaValue: quotaValueNum,
        startDate: startDate || null, endDate: endDate || null, taxPercent: taxPercentNum,
        prizes: prizesInput, costs: costsInput,
      });
      clearAfterSave();
      toast.success('Ação atualizada com sucesso!');
      navigate(`/actions/${id}`);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    }
  }

  async function handleDuplicate() {
    try {
      await duplicateAction(id!);
    } catch (err: any) {
      toast.error(`Erro ao duplicar: ${err.message}`);
    }
  }

  async function handleCreatePrizeType() {
    if (!newPrizeTypeName.trim()) return;
    try {
      await createPrizeType.mutateAsync(newPrizeTypeName.trim());
      setNewPrizeTypeName(''); setShowNewPrizeType(false);
      toast.success('Tipo de premiação criado!');
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleCreateCostType() {
    if (!newCostTypeName.trim()) return;
    try {
      await createCostType.mutateAsync(newCostTypeName.trim());
      setNewCostTypeName(''); setShowNewCostType(false);
      toast.success('Tipo de custo criado!');
    } catch (err: any) { toast.error(err.message); }
  }

  const activePrizeTypes = prizeTypes.filter(t => t.active);
  const activeCostTypes = costTypes.filter(t => t.active);

  return (
    <AppLayout>
      <AppHeader
        title={readOnly ? action.name : 'Editar Ação'}
        subtitle={readOnly ? 'Visualização (somente leitura)' : undefined}
        actions={
          <div className="flex gap-2">
            <Link to={`/actions/${id}`}>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />Voltar
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDuplicate} disabled={isDuplicating}>
              {isDuplicating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              Duplicar Ação
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6 max-w-4xl">

        {/* Draft recovery */}
        {draft && !readOnly && <DraftBanner onRestore={restoreDraft} onDiscard={discardDraft} />}

        {/* Status warnings */}
        {isCompleted && (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Ação concluída não pode ser editada. Use "Duplicar Ação" para criar uma cópia editável.
            </AlertDescription>
          </Alert>
        )}
        {isArchived && (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Ação arquivada não pode ser editada. Restaure a ação primeiro ou use "Duplicar Ação".
            </AlertDescription>
          </Alert>
        )}
        {isActive && !readOnly && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você está editando uma ação ativa. Alterações impactarão os números financeiros.
            </AlertDescription>
          </Alert>
        )}

        {/* 1. DADOS BÁSICOS */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold">1. Dados Básicos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nome da ação *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} disabled={readOnly} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label>Status *</Label>
              <Select value={status} onValueChange={v => setStatus(v as any)} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planejamento</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div />
            <div>
              <Label>Data início</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={readOnly} />
            </div>
          </div>
        </section>

        {/* 2. CONFIGURAÇÃO DE VENDA */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold">2. Configuração de Venda</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Quantidade de cotas *</Label>
              <Select value={quotaCount?.toString() ?? ''} onValueChange={v => setQuotaCount(parseInt(v))} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectGroup>
                    <SelectLabel>Mais utilizadas</SelectLabel>
                    {QUOTA_OPTIONS_POPULAR.map(q => <SelectItem key={`pop-${q}`} value={q.toString()}>{fmtQuota(q)}</SelectItem>)}
                  </SelectGroup>
                  <Separator className="my-1" />
                  <SelectGroup>
                    <SelectLabel>Todas</SelectLabel>
                    {QUOTA_OPTIONS.map(q => <SelectItem key={q} value={q.toString()}>{fmtQuota(q)}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {errors.quotaCount && <p className="text-xs text-destructive mt-1">{errors.quotaCount}</p>}
            </div>
            <div>
              <Label>Valor da cota (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" value={quotaValue} onChange={e => setQuotaValue(e.target.value)} disabled={readOnly} />
              {errors.quotaValue && <p className="text-xs text-destructive mt-1">{errors.quotaValue}</p>}
            </div>
            <div>
              <Label>Receita Esperada</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm font-semibold">
                {formatCurrency(expectedRevenue)}
              </div>
            </div>
          </div>
        </section>

        {/* 3. PREMIAÇÕES */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">3. Premiações</h2>
            {!readOnly && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowNewPrizeType(true)}>
                  <Plus className="h-3 w-3 mr-1" />Novo Tipo
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setPrizes([...prizes, { typeConfigId: '', title: '', description: '', quantity: '1', unitValue: '' }])}>
                  <Plus className="h-3 w-3 mr-1" />Premiação
                </Button>
              </div>
            )}
          </div>
          {prizes.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma premiação adicionada.</p>}
          {prizes.map((p, i) => {
            const total = (parseFloat(p.quantity) || 0) * (parseFloat(p.unitValue) || 0);
            return (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Tipo *</Label>
                  <Select value={p.typeConfigId} onValueChange={v => { const arr = [...prizes]; arr[i].typeConfigId = v; setPrizes(arr); }} disabled={readOnly}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo..." /></SelectTrigger>
                    <SelectContent>{activePrizeTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors[`prize_type_${i}`] && <p className="text-xs text-destructive">{errors[`prize_type_${i}`]}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Título *</Label>
                  <Input className="h-8 text-xs" value={p.title} onChange={e => { const arr = [...prizes]; arr[i].title = e.target.value; setPrizes(arr); }} disabled={readOnly} />
                  {errors[`prize_title_${i}`] && <p className="text-xs text-destructive">{errors[`prize_title_${i}`]}</p>}
                </div>
                <div>
                  <Label className="text-xs">Qtd *</Label>
                  <Input className="h-8 text-xs" type="number" min="1" value={p.quantity} onChange={e => { const arr = [...prizes]; arr[i].quantity = e.target.value; setPrizes(arr); }} disabled={readOnly} />
                </div>
                <div>
                  <Label className="text-xs">Valor unit. *</Label>
                  <Input className="h-8 text-xs" type="number" step="0.01" min="0" value={p.unitValue} onChange={e => { const arr = [...prizes]; arr[i].unitValue = e.target.value; setPrizes(arr); }} disabled={readOnly} />
                </div>
                <div className="sm:col-span-4">
                  <Label className="text-xs">Descrição</Label>
                  <Input className="h-8 text-xs" value={p.description} onChange={e => { const arr = [...prizes]; arr[i].description = e.target.value; setPrizes(arr); }} disabled={readOnly} placeholder="Opcional" />
                </div>
                <div className="flex items-end justify-between sm:col-span-2">
                  <span className="text-xs font-semibold">Total: {formatCurrency(total)}</span>
                  {!readOnly && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setPrizes(prizes.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {prizes.length > 0 && <div className="text-right text-sm font-semibold">Total Premiações: {formatCurrency(totalPrizes)}</div>}
        </section>

        {/* 4. CUSTOS */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">4. Custos</h2>
            {!readOnly && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowNewCostType(true)}>
                  <Plus className="h-3 w-3 mr-1" />Novo Tipo
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setCosts([...costs, { typeConfigId: '', description: '', quantity: '1', unitValue: '' }])}>
                  <Plus className="h-3 w-3 mr-1" />Custo
                </Button>
              </div>
            )}
          </div>
          {costs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum custo adicionado.</p>}
          {costs.map((c, i) => {
            const subtotal = (parseFloat(c.quantity) || 0) * (parseFloat(c.unitValue) || 0);
            return (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Tipo *</Label>
                  <Select value={c.typeConfigId} onValueChange={v => { const arr = [...costs]; arr[i].typeConfigId = v; setCosts(arr); }} disabled={readOnly}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo..." /></SelectTrigger>
                    <SelectContent>{activeCostTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors[`cost_type_${i}`] && <p className="text-xs text-destructive">{errors[`cost_type_${i}`]}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Descrição *</Label>
                  <Input className="h-8 text-xs" value={c.description} onChange={e => { const arr = [...costs]; arr[i].description = e.target.value; setCosts(arr); }} disabled={readOnly} />
                  {errors[`cost_desc_${i}`] && <p className="text-xs text-destructive">{errors[`cost_desc_${i}`]}</p>}
                </div>
                <div>
                  <Label className="text-xs">Qtd *</Label>
                  <Input className="h-8 text-xs" type="number" min="1" value={c.quantity} onChange={e => { const arr = [...costs]; arr[i].quantity = e.target.value; setCosts(arr); }} disabled={readOnly} />
                </div>
                <div>
                  <Label className="text-xs">Valor unit. *</Label>
                  <Input className="h-8 text-xs" type="number" step="0.01" min="0" value={c.unitValue} onChange={e => { const arr = [...costs]; arr[i].unitValue = e.target.value; setCosts(arr); }} disabled={readOnly} />
                </div>
                <div className="flex items-end justify-between sm:col-span-6">
                  <span className="text-xs font-semibold">Subtotal: {formatCurrency(subtotal)}</span>
                  {!readOnly && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setCosts(costs.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {costs.length > 0 && <div className="text-right text-sm font-semibold">Total Custos: {formatCurrency(totalCosts)}</div>}
        </section>

        {/* 5. IMPOSTOS */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold">5. Impostos / Legalização</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Percentual sobre Receita (%)</Label>
              <Input type="number" step="0.1" min="0" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} disabled={readOnly} />
              {errors.taxPercent && <p className="text-xs text-destructive mt-1">{errors.taxPercent}</p>}
            </div>
            <div>
              <Label>Valor calculado</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm">{formatCurrency(taxValue)}</div>
            </div>
          </div>
        </section>

        {/* 6. RESUMO FINANCEIRO */}
        <section className={`rounded-xl border p-4 space-y-3 ${grossProfit < 0 ? 'border-destructive bg-destructive/5' : 'bg-card'}`}>
          <h2 className="text-sm font-semibold">6. Resumo Financeiro</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Receita Esperada</p>
              <p className="font-semibold">{formatCurrency(expectedRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Premiações</p>
              <p className="font-semibold">{formatCurrency(totalPrizes)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Custos + Impostos</p>
              <p className="font-semibold">{formatCurrency(totalCosts + taxValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lucro Bruto</p>
              <p className={`font-bold ${grossProfit < 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(grossProfit)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Margem</p>
              <p className={`font-bold ${marginPercent < 0 ? 'text-destructive' : 'text-success'}`}>{formatPercent(marginPercent)}</p>
            </div>
          </div>
          {grossProfit < 0 && (
            <div className="flex items-center gap-2 text-destructive text-xs font-medium">
              <AlertTriangle className="h-4 w-4" />
              Atenção: O lucro está negativo!
            </div>
          )}
        </section>

        {/* SAVE / ACTIONS */}
        <div className="flex justify-end gap-3">
          <Link to={`/actions/${id}`}>
            <Button variant="outline">Cancelar</Button>
          </Link>
          {!readOnly && (
            <Button onClick={() => handleSave()} disabled={updateAction.isPending} className="gradient-primary text-primary-foreground hover:opacity-90">
              {updateAction.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Alterações
            </Button>
          )}
        </div>

        {/* 7. HISTÓRICO DE ALTERAÇÕES */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Histórico de Alterações</h2>
          </div>
          {auditLog.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma alteração registrada.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-auto">
              {auditLog.map(entry => {
                const opLabels: Record<string, string> = {
                  create: 'Criação', update: 'Atualização', delete: 'Exclusão',
                  archive: 'Arquivamento', restore: 'Restauração', duplicate: 'Duplicação',
                };
                return (
                  <div key={entry.id} className="p-3 rounded-lg border bg-muted/30 text-xs space-y-1">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{opLabels[entry.operation] || entry.operation}</span>
                        {entry.userName && (
                          <span className="text-muted-foreground">por {entry.userName}</span>
                        )}
                      </div>
                      <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <div className="space-y-0.5 mt-1">
                        {Object.entries(entry.changes).map(([key, val]) => {
                          if (val && typeof val === 'object' && 'before' in val && 'after' in val) {
                            return (
                              <div key={key} className="flex gap-2">
                                <span className="text-muted-foreground w-32 shrink-0">{key}:</span>
                                <span className="text-destructive line-through">{String(val.before ?? '—')}</span>
                                <span>→</span>
                                <span className="text-success">{String(val.after ?? '—')}</span>
                              </div>
                            );
                          }
                          if (Array.isArray(val)) {
                            return (
                              <div key={key}>
                                <span className="text-muted-foreground">{key}:</span>
                                <ul className="ml-4 list-disc">
                                  {val.map((item, idx) => <li key={idx}>{String(item)}</li>)}
                                </ul>
                              </div>
                            );
                          }
                          return (
                            <div key={key} className="flex gap-2">
                              <span className="text-muted-foreground w-32 shrink-0">{key}:</span>
                              <span>{String(val)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="pb-8" />
      </div>

      {/* Dialogs */}
      <AlertDialog open={showNewPrizeType} onOpenChange={setShowNewPrizeType}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Novo Tipo de Premiação</AlertDialogTitle>
            <AlertDialogDescription>Crie um novo tipo de premiação.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={newPrizeTypeName} onChange={e => setNewPrizeTypeName(e.target.value)} placeholder="Ex: Giro Abençoado" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreatePrizeType} disabled={!newPrizeTypeName.trim()}>Criar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showNewCostType} onOpenChange={setShowNewCostType}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Novo Tipo de Custo</AlertDialogTitle>
            <AlertDialogDescription>Crie um novo tipo de custo.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={newCostTypeName} onChange={e => setNewCostTypeName(e.target.value)} placeholder="Ex: Comissão" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateCostType} disabled={!newCostTypeName.trim()}>Criar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Negative profit */}
      <AlertDialog open={showNegativeProfitAlert} onOpenChange={setShowNegativeProfitAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />Lucro Negativo
            </AlertDialogTitle>
            <AlertDialogDescription>
              O lucro bruto é <strong>{formatCurrency(grossProfit)}</strong> (margem: {formatPercent(marginPercent)}).
              Tem certeza que deseja salvar com prejuízo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowNegativeProfitAlert(false); handleSave(true, isActive); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Salvar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Active action warning */}
      <AlertDialog open={showActiveWarning} onOpenChange={setShowActiveWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />Ação Ativa
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está alterando uma ação ativa. Isso impacta os números financeiros. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowActiveWarning(false); handleSave(grossProfit < 0, true); }}>
              Confirmar e Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
