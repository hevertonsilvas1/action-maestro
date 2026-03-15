import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { insertAuditLog } from '@/hooks/useAuditLogger';
import { useWinners } from '@/hooks/useWinners';
import { usePrizes } from '@/hooks/usePrizes';
import { usePrizeLimits } from '@/hooks/usePrizeLimits';

const PRIZE_TYPES = [
  { value: 'spin', label: 'Giro Abençoado' },
  { value: 'quota', label: 'Cota Premiada' },
  { value: 'blessed_hour', label: 'Horário Abençoado' },
  { value: 'main', label: 'Principal' },
  { value: 'instant', label: 'Instantâneo' },
  { value: 'bonus', label: 'Bônus' },
];

interface NewWinnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultActionId?: string;
  actionsMap: Record<string, string>;
}

export function NewWinnerModal({
  open, onOpenChange, defaultActionId, actionsMap,
}: NewWinnerModalProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [dupWarning, setDupWarning] = useState(false);

  const [form, setForm] = useState({
    actionId: defaultActionId || '',
    prizeType: '',
    prizeTitle: '',
    name: '',
    phone: '',
    cpf: '',
    value: '',
    observation: '',
    prizeDatetime: new Date().toISOString().slice(0, 16), // default to now (datetime-local format)
  });

  // Load prizes and winners for the selected action to check limits
  const { data: actionPrizes } = usePrizes(form.actionId);
  const { data: actionWinners } = useWinners(form.actionId || undefined);
  const { canAdd, exhaustedMessage, limits } = usePrizeLimits(actionPrizes, actionWinners);

  const update = (partial: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...partial }));
    setDupWarning(false);
  };

  const reset = () => {
    setForm({
      actionId: defaultActionId || '',
      prizeType: '',
      prizeTitle: '',
      name: '',
      phone: '',
      cpf: '',
      value: '',
      observation: '',
      prizeDatetime: new Date().toISOString().slice(0, 16),
    });
    setDupWarning(false);
  };

  const phoneDigits = form.phone.replace(/\D/g, '');
  const isPhoneValid = phoneDigits.length === 0 || (phoneDigits.length >= 10 && phoneDigits.length <= 11);
  const valueNum = parseFloat(form.value.replace(',', '.')) || 0;

  // Check prize limit for selected type
  const prizeLimitExhausted = form.prizeType && form.actionId ? !canAdd(form.prizeType) : false;
  const prizeLimitMsg = form.prizeType ? exhaustedMessage(form.prizeType) : null;

  const canSave =
    form.actionId &&
    form.prizeType &&
    form.name.trim().length >= 2 &&
    valueNum > 0 &&
    isPhoneValid &&
    !saving &&
    !prizeLimitExhausted;

  const handleSave = async (force = false) => {
    if (!canSave) return;
    setSaving(true);

    try {
      // Duplicate check
      if (!force) {
        const { data: existing } = await supabase
          .from('winners')
          .select('id')
          .eq('action_id', form.actionId)
          .eq('phone', phoneDigits || null)
          .eq('value', valueNum)
          .eq('prize_type', form.prizeType as any)
          .limit(1);

        if (existing && existing.length > 0 && phoneDigits) {
          setDupWarning(true);
          setSaving(false);
          return;
        }
      }

      // Build prize_datetime: if user provided date but no time, append current time
      let prizeDt: string | null = null;
      if (form.prizeDatetime) {
        const dt = new Date(form.prizeDatetime);
        if (!isNaN(dt.getTime())) {
          prizeDt = dt.toISOString();
        }
      }

      const { error } = await supabase.from('winners').insert({
        action_id: form.actionId,
        name: form.name.trim(),
        full_name: form.name.trim(),
        phone: phoneDigits || null,
        cpf: form.cpf.replace(/\D/g, '') || null,
        value: valueNum,
        prize_type: form.prizeType as any,
        prize_title: form.prizeTitle.trim() || PRIZE_TYPES.find(p => p.value === form.prizeType)?.label || form.prizeType,
        prize_datetime: prizeDt,
        status: 'imported' as any,
      });

      if (error) throw error;

      await insertAuditLog({
        actionId: form.actionId,
        actionName: actionsMap[form.actionId] || '',
        tableName: 'winners',
        operation: 'create',
        changes: {
          name: form.name.trim(),
          prize_type: form.prizeType,
          value: valueNum,
          source: 'manual',
          observation: form.observation || undefined,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['winners'] });
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      toast.success('Ganhador adicionado com sucesso!');
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao adicionar ganhador.');
    } finally {
      setSaving(false);
    }
  };

  const actionEntries = Object.entries(actionsMap).sort((a, b) => a[1].localeCompare(b[1]));

  // Helper to show remaining slots in prize type options
  const getPrizeTypeLabel = (type: { value: string; label: string }) => {
    const info = limits.get(type.value);
    if (!info) return type.label;
    return `${type.label} (${info.remaining}/${info.planned} restantes)`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Ganhador</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action */}
          <div className="space-y-1.5">
            <Label className="text-xs">Ação *</Label>
            <Select value={form.actionId} onValueChange={(v) => update({ actionId: v, prizeType: '' })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {actionEntries.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prize Type + Title */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Premiação *</Label>
              <Select value={form.prizeType} onValueChange={(v) => update({ prizeType: v })}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {PRIZE_TYPES.map((p) => {
                    const info = limits.get(p.value);
                    const exhausted = info ? info.isExhausted : false;
                    return (
                      <SelectItem key={p.value} value={p.value} disabled={exhausted}>
                        {getPrizeTypeLabel(p)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título (opcional)</Label>
              <Input
                value={form.prizeTitle}
                onChange={(e) => update({ prizeTitle: e.target.value })}
                placeholder="Ex: 1ª Cota"
                className="h-9 text-xs"
                maxLength={100}
              />
            </div>
          </div>

          {/* Prize limit warning */}
          {prizeLimitExhausted && prizeLimitMsg && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-medium text-destructive">Limite de premiação atingido</p>
                <p className="text-muted-foreground">{prizeLimitMsg}</p>
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do Ganhador *</Label>
            <Input
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Nome completo"
              className="h-9 text-xs"
              maxLength={200}
            />
          </div>

          {/* Phone + CPF */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => update({ phone: e.target.value })}
                placeholder="(99) 99999-9999"
                className="h-9 text-xs"
                maxLength={15}
              />
              {form.phone && !isPhoneValid && (
                <p className="text-[10px] text-destructive">Telefone inválido (10 ou 11 dígitos)</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CPF</Label>
              <Input
                value={form.cpf}
                onChange={(e) => update({ cpf: e.target.value })}
                placeholder="000.000.000-00"
                className="h-9 text-xs"
                maxLength={14}
              />
            </div>
          </div>

          {/* Value + Prize DateTime */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor do Prêmio (R$) *</Label>
              <Input
                value={form.value}
                onChange={(e) => update({ value: e.target.value })}
                placeholder="0,00"
                className="h-9 text-xs"
                type="text"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data/Hora da Premiação</Label>
              <Input
                type="datetime-local"
                value={form.prizeDatetime}
                onChange={(e) => update({ prizeDatetime: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Observation */}
          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Input
              value={form.observation}
              onChange={(e) => update({ observation: e.target.value })}
              placeholder="Nota interna..."
              className="h-9 text-xs"
              maxLength={300}
            />
          </div>

          {/* Duplicate warning */}
          {dupWarning && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-medium text-warning">Possível duplicidade detectada</p>
                <p className="text-muted-foreground">
                  Já existe um ganhador nesta ação com mesmo telefone, valor e tipo de premiação.
                </p>
                <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => handleSave(true)}>
                  Salvar mesmo assim
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => handleSave(false)} disabled={!canSave}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Adicionar Ganhador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
