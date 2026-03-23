import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, CreditCard, CheckCircle2, ShieldCheck, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { validatePixKey, maskPixKey, getPixStatus, getPixContextWarnings, detectPixType, type PixContextWarning } from '@/lib/pix-validation';
import { PIX_TYPE_LABELS, PIX_LOCKED_STATUSES } from '@/types';
import { usePixValidationEnabled } from '@/hooks/usePixValidationConfig';
import type { Winner, PixType } from '@/types';

interface PixDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winner: Winner | null;
  isAdmin: boolean;
  userName: string;
  actionId: string;
}

export function PixDataModal({ open, onOpenChange, winner, isAdmin, userName, actionId }: PixDataModalProps) {
  const queryClient = useQueryClient();
  const { data: pixValidationEnabled = false } = usePixValidationEnabled();
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [adminReason, setAdminReason] = useState('');
  const [additionalOpen, setAdditionalOpen] = useState(false);

  const [pixType, setPixType] = useState<PixType | ''>('');
  const [pixKey, setPixKey] = useState('');
  const [holderName, setHolderName] = useState('');
  const [holderDoc, setHolderDoc] = useState('');
  const [observation, setObservation] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [contextWarnings, setContextWarnings] = useState<PixContextWarning[]>([]);

  const isLocked = winner ? PIX_LOCKED_STATUSES.includes(winner.status) : false;
  const canEdit = !isLocked || isAdmin;
  const pixStatus = winner ? getPixStatus(winner) : 'none';

  useEffect(() => {
    if (winner && open) {
      const type = (winner.pixType as PixType) || '';
      const key = winner.pixKey || '';
      setPixType(type);
      setPixKey(key);
      setHolderName(winner.pixHolderName || '');
      setHolderDoc(winner.pixHolderDoc || '');
      setObservation(winner.pixObservation || '');
      setKeyError(null);
      setAdminReason('');
      setAdditionalOpen(!!(winner.pixHolderName || winner.pixHolderDoc));
      if (type && key.trim()) {
        setContextWarnings(getPixContextWarnings(type as PixType, key, { cpf: winner.cpf, phone: winner.phone }));
      } else {
        setContextWarnings([]);
      }
    }
  }, [winner, open]);

  const handleKeyChange = (value: string) => {
    setPixKey(value);
    const detected = detectPixType(value);
    const type = detected || '';
    setPixType(type);

    if (type && value.trim()) {
      setKeyError(validatePixKey(type as PixType, value));
      if (winner) {
        setContextWarnings(getPixContextWarnings(type as PixType, value, { cpf: winner.cpf, phone: winner.phone }));
      }
    } else {
      setKeyError(null);
      setContextWarnings([]);
    }
  };

  const handleSave = async () => {
    if (!winner || !pixType || !pixKey.trim()) return;
    const error = validatePixKey(pixType as PixType, pixKey);
    if (error) {
      setKeyError(error);
      return;
    }

    if (isLocked && isAdmin && !adminReason.trim()) {
      toast.error('Informe o motivo da alteração (obrigatório para status bloqueado).');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const isNew = !winner.pixKey;

      const updateData: Record<string, any> = {
        pix_type: pixType,
        pix_key: pixKey.trim(),
        pix_holder_name: holderName.trim() || null,
        pix_holder_doc: holderDoc.trim() || null,
        pix_observation: observation.trim() || null,
        updated_at: now,
      };

      if (isNew) {
        updateData.pix_registered_by = userName;
        updateData.pix_registered_at = now;
      }

      if (!pixValidationEnabled && isNew) {
        updateData.status = 'pix_received';
        updateData.pix_validated_by = userName;
        updateData.pix_validated_at = now;
      }

      const { error: updateError } = await supabase
        .from('winners')
        .update(updateData)
        .eq('id', winner.id);

      if (updateError) throw updateError;

      const changes: Record<string, any> = {
        winner_name: winner.name,
        operation_type: isNew ? 'pix_cadastro' : 'pix_edicao',
      };

      if (!isNew) {
        if (winner.pixType !== pixType) changes.pix_type = { before: winner.pixType || '—', after: pixType };
        if (winner.pixKey !== pixKey.trim()) changes.pix_key = { before: maskPixKey(winner.pixType, winner.pixKey), after: maskPixKey(pixType, pixKey.trim()) };
        if (winner.pixHolderName !== (holderName.trim() || undefined)) changes.pix_holder_name = { before: winner.pixHolderName || '—', after: holderName.trim() || '—' };
      } else {
        changes.pix_type = pixType;
        changes.pix_key = maskPixKey(pixType, pixKey.trim());
        if (holderName.trim()) changes.pix_holder_name = holderName.trim();
      }

      if (isLocked && adminReason.trim()) {
        changes.admin_reason = adminReason.trim();
      }

      if (!pixValidationEnabled && isNew) {
        changes.auto_validated = true;
        changes.status = { before: winner.status, after: 'pix_received' };
      }

      await supabase.from('action_audit_log').insert({
        action_id: actionId,
        table_name: 'winners',
        record_id: winner.id,
        operation: !pixValidationEnabled && isNew ? 'pix_cadastro_auto_validado' : (isNew ? 'pix_cadastro' : 'pix_edicao'),
        user_name: userName,
        changes,
      });

      await queryClient.invalidateQueries({ queryKey: ['winners'] });
      if (!pixValidationEnabled && isNew) {
        toast.success('PIX cadastrado e validado automaticamente!');
      } else {
        toast.success(isNew ? 'PIX cadastrado com sucesso!' : 'PIX atualizado com sucesso!');
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Save PIX error:', err);
      toast.error('Erro ao salvar dados do PIX.');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!winner || !winner.pixKey || !winner.pixType) return;

    setValidating(true);
    try {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('winners')
        .update({
          pix_validated_by: userName,
          pix_validated_at: now,
          status: 'pix_received',
          updated_at: now,
        })
        .eq('id', winner.id);

      if (updateError) throw updateError;

      await supabase.from('action_audit_log').insert({
        action_id: actionId,
        table_name: 'winners',
        record_id: winner.id,
        operation: 'pix_validacao',
        user_name: userName,
        changes: {
          winner_name: winner.name,
          pix_type: winner.pixType,
          pix_key: maskPixKey(winner.pixType, winner.pixKey),
          status: { before: winner.status, after: 'pix_received' },
        },
      });

      await queryClient.invalidateQueries({ queryKey: ['winners'] });
      toast.success('PIX validado! Status atualizado para "Pix Recebido / Validado".');
      onOpenChange(false);
    } catch (err) {
      console.error('Validate PIX error:', err);
      toast.error('Erro ao validar PIX.');
    } finally {
      setValidating(false);
    }
  };

  if (!winner) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Dados do PIX
          </DialogTitle>
          <DialogDescription>
            {winner.name} — {winner.prizeTitle}
          </DialogDescription>
        </DialogHeader>

        {/* PIX Status Indicator */}
        <div className="flex items-center gap-2">
          {pixStatus === 'none' && (
            <Badge variant="outline" className="text-muted-foreground gap-1">
              <AlertTriangle className="h-3 w-3" /> Não informado
            </Badge>
          )}
          {pixStatus === 'filled' && (
            <Badge variant="outline" className="text-info gap-1 border-info/30 bg-info/5">
              <CreditCard className="h-3 w-3" /> Informado
            </Badge>
          )}
          {pixStatus === 'validated' && (
            <Badge variant="outline" className="text-success gap-1 border-success/30 bg-success/5">
              <ShieldCheck className="h-3 w-3" /> Validado
            </Badge>
          )}
          {winner.pixRegisteredBy && (
            <span className="text-[10px] text-muted-foreground">
              Cadastrado por {winner.pixRegisteredBy}
              {winner.pixRegisteredAt && ` em ${new Date(winner.pixRegisteredAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`}
            </span>
          )}
        </div>

        {isLocked && !isAdmin && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            PIX bloqueado para edição neste status. Somente Admin pode alterar.
          </div>
        )}

        <Separator />

        <div className="space-y-4">
          {/* Main field: PIX Key with auto-detection */}
          <div className="space-y-2">
            <Label className="text-xs">Chave PIX *</Label>
            <Input
              value={pixKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="Digite ou cole a chave PIX (CPF, telefone, email ou chave aleatória)"
              disabled={!canEdit}
              className="font-mono text-sm"
              autoFocus
            />
            <div className="flex items-center gap-2">
              {pixType && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  Tipo detectado: {PIX_TYPE_LABELS[pixType as PixType] || pixType}
                </Badge>
              )}
              {pixKey.trim() && !pixType && (
                <span className="text-[10px] text-muted-foreground">
                  Continue digitando para detectar o tipo...
                </span>
              )}
            </div>
            {keyError && <p className="text-[10px] text-destructive">{keyError}</p>}
            {!keyError && contextWarnings.length > 0 && (
              <div className="space-y-2 mt-2">
                {contextWarnings.map((w, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 text-xs space-y-2 ${
                      w.level === 'critical'
                        ? 'border-destructive/50 bg-destructive/5'
                        : 'border-amber-400/50 bg-amber-50 dark:bg-amber-950/20'
                    }`}
                  >
                    <p className={`font-semibold flex items-center gap-1.5 ${
                      w.level === 'critical' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
                    }`}>
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {w.message}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">{w.type === 'cpf' ? 'CPF do ganhador:' : 'Telefone cadastrado:'}</span>
                        <p className="font-mono font-medium">{w.winnerValue}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{w.type === 'cpf' ? 'CPF na chave PIX:' : 'Telefone informado:'}</span>
                        <p className="font-mono font-medium">{w.pixValue}</p>
                      </div>
                    </div>
                    {w.detail && (
                      <p className="text-muted-foreground text-[11px] leading-relaxed">{w.detail}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observation */}
          <div className="space-y-2">
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: PIX de terceiro, PIX da esposa, autorizado pelo cliente..."
              disabled={!canEdit}
              rows={2}
              maxLength={200}
            />
          </div>

          {/* Collapsible additional info */}
          <Collapsible open={additionalOpen} onOpenChange={setAdditionalOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {additionalOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Informações adicionais
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Nome do Titular</Label>
                  <Input
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder="Nome completo do titular"
                    disabled={!canEdit}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">CPF/CNPJ do Titular</Label>
                  <Input
                    value={holderDoc}
                    onChange={(e) => setHolderDoc(e.target.value)}
                    placeholder="Documento do titular"
                    disabled={!canEdit}
                    maxLength={18}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {isLocked && isAdmin && (
            <div className="space-y-2">
              <Label className="text-xs text-destructive">Motivo da alteração (obrigatório) *</Label>
              <Input
                value={adminReason}
                onChange={(e) => setAdminReason(e.target.value)}
                placeholder="Informe o motivo da correção..."
                maxLength={200}
              />
            </div>
          )}

          {winner.pixValidatedBy && (
            <div className="text-[10px] text-muted-foreground border-t pt-2">
              Validado por <span className="font-medium">{winner.pixValidatedBy}</span>
              {winner.pixValidatedAt && ` em ${new Date(winner.pixValidatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {pixValidationEnabled && pixStatus === 'filled' && canEdit && (
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={validating || saving}
              className="gap-1.5"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Validar PIX
            </Button>
          )}
          {canEdit && (
            <Button
              onClick={handleSave}
              disabled={saving || validating || !pixType || !pixKey.trim()}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {winner.pixKey ? 'Salvar Alterações' : 'Cadastrar PIX'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
