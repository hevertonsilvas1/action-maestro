import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, GripVertical, Zap, Hand } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useWinnerStatuses,
  useCreateWinnerStatus,
  useUpdateWinnerStatus,
  type WinnerStatusConfig,
} from '@/hooks/useWinnerStatuses';

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

export function WinnerStatusesTab() {
  const { data: statuses, isLoading } = useWinnerStatuses();
  const createMutation = useCreateWinnerStatus();
  const updateMutation = useUpdateWinnerStatus();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const openCreate = () => {
    const nextOrder = statuses ? Math.max(...statuses.map(s => s.sort_order), -1) + 1 : 0;
    setForm({ ...emptyForm, sort_order: nextOrder });
    setEditingId(null);
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

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });
        toast({ title: 'Status atualizado!' });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Status criado!' });
      }
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
      // Unset current default first
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
              <CardDescription>Gerencie os status do fluxo operacional dos ganhadores</CardDescription>
            </div>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Novo status
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Evento gatilho</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses && statuses.length > 0 ? (
                  statuses.map((status) => (
                    <TableRow key={status.id} className={!status.is_active ? 'opacity-50' : ''}>
                      <TableCell className="text-muted-foreground text-xs">
                        <div className="flex items-center gap-1">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                          {status.sort_order}
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
                        <Switch
                          checked={status.is_active}
                          onCheckedChange={() => handleToggleActive(status)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(status)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!status.is_default && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleSetDefault(status)}
                            >
                              Definir padrão
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      Nenhum status cadastrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar status' : 'Novo status'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Altere as propriedades do status' : 'Configure um novo status para o fluxo de ganhadores'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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

            <div className="space-y-2">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descreva quando esse status é utilizado"
              />
            </div>

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
