import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, GripVertical, Zap, Hand, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useWinnerStatuses,
  useCreateWinnerStatus,
  useUpdateWinnerStatus,
  useStatusTransitions,
  useSaveTransitions,
  type WinnerStatusConfig,
} from '@/hooks/useWinnerStatuses';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TRIGGER_EVENTS = [
  { value: 'winner_created', label: 'Ganhador criado/importado' },
  { value: 'pix_request_sent', label: 'Solicitação de PIX enviada' },
  { value: 'pix_key_received', label: 'Chave PIX recebida' },
  { value: 'payment_registered', label: 'Pagamento registrado' },
  { value: 'receipt_attached', label: 'Comprovante anexado' },
  { value: 'receipt_sent', label: 'Comprovante enviado' },
  { value: 'manual_review_required', label: 'Análise manual necessária' },
  { value: 'process_completed', label: 'Processo finalizado' },
] as const;

type FormData = {
  name: string;
  slug: string;
  color: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  update_mode: 'manual' | 'automatic';
  trigger_event: string;
};

const emptyForm: FormData = {
  name: '',
  slug: '',
  color: '#6b7280',
  description: '',
  sort_order: 0,
  is_active: true,
  is_default: false,
  update_mode: 'manual',
  trigger_event: '',
};

// Sortable row component
function SortableStatusRow({
  status,
  transitionCount,
  onEdit,
  onToggleActive,
  onSetDefault,
}: {
  status: WinnerStatusConfig;
  transitionCount: number;
  onEdit: (s: WinnerStatusConfig) => void;
  onToggleActive: (s: WinnerStatusConfig) => void;
  onSetDefault: (s: WinnerStatusConfig) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : status.is_active ? 1 : 0.5,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="text-muted-foreground text-xs">
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded hover:bg-accent"
            aria-label="Reordenar"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/60" />
          </button>
          <span className="min-w-[1.5rem] text-center">{status.sort_order}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
            style={{ backgroundColor: status.color }}
          >
            {status.name}
          </span>
          {status.is_default && (
            <Badge variant="outline" className="text-[10px]">Padrão</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded border" style={{ backgroundColor: status.color }} />
          <span className="text-xs font-mono text-muted-foreground">{status.color}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-xs">
          {status.update_mode === 'automatic' ? (
            <>
              <Zap className="h-3.5 w-3.5 text-warning" />
              Automático
            </>
          ) : (
            <>
              <Hand className="h-3.5 w-3.5 text-muted-foreground" />
              Manual
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        {status.trigger_event ? (
          <Badge variant="secondary" className="text-[10px] font-mono">
            {status.trigger_event}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        {transitionCount > 0 ? (
          <Badge variant="outline" className="text-[10px] gap-1">
            <ArrowRight className="h-3 w-3" />
            {transitionCount}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={status.is_active}
          onCheckedChange={() => onToggleActive(status)}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(status)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {!status.is_default && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onSetDefault(status)}
            >
              Definir padrão
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function WinnerStatusesTab() {
  const { data: statuses, isLoading } = useWinnerStatuses();
  const { data: transitions } = useStatusTransitions();
  const createMutation = useCreateWinnerStatus();
  const updateMutation = useUpdateWinnerStatus();
  const saveTransitionsMutation = useSaveTransitions();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [selectedTransitions, setSelectedTransitions] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sorted = statuses ? [...statuses].sort((a, b) => a.sort_order - b.sort_order) : [];

  // Map: from_status_id -> count of allowed transitions
  const transitionCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    (transitions || []).forEach(t => {
      map[t.from_status_id] = (map[t.from_status_id] || 0) + 1;
    });
    return map;
  }, [transitions]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !statuses) return;

    const oldIndex = sorted.findIndex(s => s.id === active.id);
    const newIndex = sorted.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sorted, oldIndex, newIndex);

    try {
      const updates = reordered.map((s, i) =>
        updateMutation.mutateAsync({ id: s.id, sort_order: i })
      );
      await Promise.all(updates);
      toast({ title: 'Ordem atualizada!' });
    } catch (err: any) {
      toast({ title: 'Erro ao reordenar', description: err.message, variant: 'destructive' });
    }
  }, [sorted, statuses, updateMutation, toast]);

  const openCreate = () => {
    const nextOrder = statuses ? Math.max(...statuses.map(s => s.sort_order), -1) + 1 : 0;
    setForm({ ...emptyForm, sort_order: nextOrder });
    setEditingId(null);
    setSelectedTransitions([]);
    setDialogOpen(true);
  };

  const openEdit = (status: WinnerStatusConfig) => {
    setForm({
      name: status.name,
      slug: status.slug,
      color: status.color,
      description: status.description || '',
      sort_order: status.sort_order,
      is_active: status.is_active,
      is_default: status.is_default,
      update_mode: status.update_mode,
      trigger_event: status.trigger_event || '',
    });
    setEditingId(status.id);
    // Load current transitions
    const current = (transitions || [])
      .filter(t => t.from_status_id === status.id)
      .map(t => t.to_status_id);
    setSelectedTransitions(current);
    setDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const handleNameChange = (name: string) => {
    setForm(f => ({
      ...f,
      name,
      ...(editingId ? {} : { slug: generateSlug(name) }),
    }));
  };

  const toggleTransition = (toStatusId: string) => {
    setSelectedTransitions(prev =>
      prev.includes(toStatusId)
        ? prev.filter(id => id !== toStatusId)
        : [...prev, toStatusId]
    );
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast({ title: 'Preencha nome e slug', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        color: form.color,
        description: form.description.trim() || null,
        sort_order: form.sort_order,
        is_active: form.is_active,
        is_default: form.is_default,
        update_mode: form.update_mode,
        trigger_event: form.update_mode === 'automatic' ? (form.trigger_event || null) : null,
      };

      let statusId = editingId;

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });
      } else {
        const created = await createMutation.mutateAsync(payload);
        statusId = created.id;
      }

      // Save transitions
      if (statusId) {
        await saveTransitionsMutation.mutateAsync({
          fromStatusId: statusId,
          toStatusIds: selectedTransitions,
        });
      }

      toast({ title: editingId ? 'Status atualizado!' : 'Status criado!' });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (status: WinnerStatusConfig) => {
    try {
      await updateMutation.mutateAsync({ id: status.id, is_active: !status.is_active });
      toast({ title: `Status ${!status.is_active ? 'ativado' : 'desativado'}` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleSetDefault = async (status: WinnerStatusConfig) => {
    try {
      const currentDefault = statuses?.find(s => s.is_default && s.id !== status.id);
      if (currentDefault) {
        await updateMutation.mutateAsync({ id: currentDefault.id, is_default: false });
      }
      await updateMutation.mutateAsync({ id: status.id, is_default: true });
      toast({ title: `"${status.name}" definido como padrão` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || saveTransitionsMutation.isPending;

  // Other statuses for transition selection (exclude self)
  const otherStatuses = sorted.filter(s => s.id !== editingId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Status de Ganhadores</CardTitle>
              <CardDescription>
                Gerencie os status do fluxo operacional dos ganhadores. Arraste para reordenar.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Novo status
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Evento gatilho</TableHead>
                  <TableHead className="text-center">Transições</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sorted.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <TableBody>
                    {sorted.length > 0 ? (
                      sorted.map((status) => (
                        <SortableStatusRow
                          key={status.id}
                          status={status}
                          transitionCount={transitionCountMap[status.id] || 0}
                          onEdit={openEdit}
                          onToggleActive={handleToggleActive}
                          onSetDefault={handleSetDefault}
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                          Nenhum status cadastrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </SortableContext>
              </DndContext>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar status' : 'Novo status'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Altere as propriedades do status' : 'Configure um novo status para o fluxo de ganhadores'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name & Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Pix Solicitado"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Slug (identificador)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="pix_solicitado"
                  className="font-mono text-sm"
                  maxLength={100}
                  disabled={!!editingId}
                />
              </div>
            </div>

            {/* Color & Order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Cor</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                    className="h-10 w-12 rounded border border-input cursor-pointer"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                    placeholder="#6b7280"
                    className="font-mono text-sm"
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Ordem de exibição</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                  min={0}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descreva quando esse status é utilizado"
              />
            </div>

            {/* Update mode & Trigger */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Modo de atualização</Label>
                <Select
                  value={form.update_mode}
                  onValueChange={(v) => setForm(f => ({ ...f, update_mode: v as 'manual' | 'automatic' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      <div className="flex items-center gap-2">
                        <Hand className="h-3.5 w-3.5" />
                        Manual
                      </div>
                    </SelectItem>
                    <SelectItem value="automatic">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5" />
                        Automático
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.update_mode === 'automatic' && (
                <div className="space-y-2">
                  <Label className="text-xs">Evento gatilho</Label>
                  <Select
                    value={form.trigger_event}
                    onValueChange={(v) => setForm(f => ({ ...f, trigger_event: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_EVENTS.map(ev => (
                        <SelectItem key={ev.value} value={ev.value}>
                          <span className="text-xs">{ev.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Switches */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))}
                />
                <Label className="text-xs">Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_default}
                  onCheckedChange={(v) => setForm(f => ({ ...f, is_default: v }))}
                />
                <Label className="text-xs">Status padrão</Label>
              </div>
            </div>

            {/* Allowed Transitions */}
            <div className="space-y-3 pt-2 border-t">
              <div>
                <Label className="text-sm font-medium">Próximos status permitidos</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selecione para quais status este pode evoluir. Se nenhum for selecionado, todas as transições serão permitidas.
                </p>
              </div>
              {otherStatuses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {otherStatuses.map(s => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedTransitions.includes(s.id)}
                        onCheckedChange={() => toggleTransition(s.id)}
                      />
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: s.color }}
                      >
                        {s.name}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  {editingId ? 'Salve primeiro para configurar transições.' : 'Crie o status primeiro para configurar transições.'}
                </p>
              )}
              {selectedTransitions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">Pode ir para:</span>
                  {selectedTransitions.map(id => {
                    const s = sorted.find(x => x.id === id);
                    return s ? (
                      <span
                        key={id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: s.color }}
                      >
                        {s.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="pt-2">
              <Label className="text-xs text-muted-foreground mb-2 block">Pré-visualização</Label>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: form.color }}
              >
                {form.name || 'Nome do status'}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
