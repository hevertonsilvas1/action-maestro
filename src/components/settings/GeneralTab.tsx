import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Save, Settings2, Clock, Send, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ParamConfig {
  id: string;
  key: string;
  value: string;
  label: string | null;
  description: string | null;
}

const GENERAL_PARAMS = ['INBOUND_WINDOW_HOURS', 'AUTO_SEND_RECEIPT_ON_INBOUND', 'STATUS_TRANSITION_MODE'];

export function GeneralTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ParamConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const fetchConfigs = async () => {
    const { data, error } = await supabase
      .from('integration_configs')
      .select('*')
      .in('key', GENERAL_PARAMS);

    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    } else {
      setConfigs(data || []);
      const values: Record<string, string> = {};
      (data || []).forEach((c: ParamConfig) => { values[c.key] = c.value; });
      setEditValues(values);
    }
    setLoading(false);
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleSave = async (config: ParamConfig) => {
    if (!user) return;
    setSaving(config.key);
    const newValue = editValues[config.key] ?? config.value;
    const { error } = await supabase
      .from('integration_configs')
      .update({ value: newValue, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', config.id);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configuração atualizada!' });
      fetchConfigs();
    }
    setSaving(null);
  };

  const getWindowConfig = () => configs.find(c => c.key === 'INBOUND_WINDOW_HOURS');
  const getAutoSendConfig = () => configs.find(c => c.key === 'AUTO_SEND_RECEIPT_ON_INBOUND');
  const getTransitionModeConfig = () => configs.find(c => c.key === 'STATUS_TRANSITION_MODE');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const windowConfig = getWindowConfig();
  const autoSendConfig = getAutoSendConfig();
  const transitionModeConfig = getTransitionModeConfig();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Parâmetros Operacionais</CardTitle>
              <CardDescription>Configurações que afetam o comportamento global do sistema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* INBOUND_WINDOW_HOURS */}
          {windowConfig ? (
            <div className="flex items-start gap-4 rounded-lg border p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent">
                <Clock className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <Label className="text-sm font-medium">Janela de Interação WhatsApp</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tempo (em horas) que a janela de conversa fica aberta após a última interação do ganhador.
                    Comprovantes só podem ser enviados automaticamente dentro desta janela.
                  </p>
                </div>
                <div className="flex items-center gap-3 max-w-xs">
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={editValues['INBOUND_WINDOW_HOURS'] ?? windowConfig.value}
                    onChange={(e) => setEditValues(prev => ({ ...prev, INBOUND_WINDOW_HOURS: e.target.value }))}
                    className="w-24 text-center font-mono"
                  />
                  <span className="text-xs text-muted-foreground">horas</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave(windowConfig)}
                    disabled={saving === 'INBOUND_WINDOW_HOURS' || editValues['INBOUND_WINDOW_HOURS'] === windowConfig.value}
                    className="gap-1.5"
                  >
                    {saving === 'INBOUND_WINDOW_HOURS' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Salvar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground/40" />
              Parâmetro <code className="text-xs font-mono">INBOUND_WINDOW_HOURS</code> não encontrado na base de dados.
            </div>
          )}

          {/* AUTO_SEND_RECEIPT_ON_INBOUND */}
          {autoSendConfig ? (
            <div className="flex items-start gap-4 rounded-lg border p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent">
                <Send className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <Label className="text-sm font-medium">Envio Automático de Comprovante</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quando ativado, o sistema envia automaticamente o comprovante ao ganhador assim que ele interage via WhatsApp,
                    desde que o comprovante esteja anexado e a janela de conversa esteja aberta.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={editValues['AUTO_SEND_RECEIPT_ON_INBOUND'] !== 'false'}
                    onCheckedChange={(checked) => {
                      const newVal = checked ? 'true' : 'false';
                      setEditValues(prev => ({ ...prev, AUTO_SEND_RECEIPT_ON_INBOUND: newVal }));
                      // Auto-save on toggle
                      const config = autoSendConfig;
                      if (config) {
                        setSaving('AUTO_SEND_RECEIPT_ON_INBOUND');
                        supabase
                          .from('integration_configs')
                          .update({ value: newVal, updated_by: user?.id, updated_at: new Date().toISOString() })
                          .eq('id', config.id)
                          .then(({ error }) => {
                            if (error) {
                              toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
                            } else {
                              toast({ title: checked ? 'Envio automático ativado' : 'Envio automático desativado' });
                              fetchConfigs();
                            }
                            setSaving(null);
                          });
                      }
                    }}
                    disabled={saving === 'AUTO_SEND_RECEIPT_ON_INBOUND'}
                  />
                  <span className="text-xs font-medium">
                    {editValues['AUTO_SEND_RECEIPT_ON_INBOUND'] !== 'false' ? 'Ativado' : 'Desativado'}
                  </span>
                  {saving === 'AUTO_SEND_RECEIPT_ON_INBOUND' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              <Send className="h-5 w-5 mx-auto mb-2 text-muted-foreground/40" />
              Parâmetro <code className="text-xs font-mono">AUTO_SEND_RECEIPT_ON_INBOUND</code> não encontrado na base de dados.
            </div>
          )}
          {/* STATUS_TRANSITION_MODE */}
          {transitionModeConfig ? (
            <div className="flex items-start gap-4 rounded-lg border p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent">
                <ArrowRightLeft className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <Label className="text-sm font-medium">Modo de Transição de Status</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Define como o sistema valida mudanças de status dos ganhadores.
                  </p>
                </div>
                <RadioGroup
                  value={editValues['STATUS_TRANSITION_MODE'] ?? transitionModeConfig.value}
                  onValueChange={(val) => {
                    setEditValues(prev => ({ ...prev, STATUS_TRANSITION_MODE: val }));
                    setSaving('STATUS_TRANSITION_MODE');
                    supabase
                      .from('integration_configs')
                      .update({ value: val, updated_by: user?.id, updated_at: new Date().toISOString() })
                      .eq('id', transitionModeConfig.id)
                      .then(({ error }) => {
                        if (error) {
                          toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
                        } else {
                          toast({ title: 'Modo de transição atualizado!' });
                          fetchConfigs();
                        }
                        setSaving(null);
                      });
                  }}
                  disabled={saving === 'STATUS_TRANSITION_MODE'}
                  className="space-y-2"
                >
                  <div className="flex items-start gap-3 rounded-md border p-3">
                    <RadioGroupItem value="free" id="mode-free" className="mt-0.5" />
                    <div>
                      <Label htmlFor="mode-free" className="text-sm font-medium cursor-pointer">Livre</Label>
                      <p className="text-xs text-muted-foreground">
                        Qualquer status pode ser alterado para qualquer outro, sem restrições.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-md border p-3">
                    <RadioGroupItem value="controlled" id="mode-controlled" className="mt-0.5" />
                    <div>
                      <Label htmlFor="mode-controlled" className="text-sm font-medium cursor-pointer">Controlado</Label>
                      <p className="text-xs text-muted-foreground">
                        O sistema respeita integralmente as transições configuradas entre status.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-md border p-3">
                    <RadioGroupItem value="hybrid" id="mode-hybrid" className="mt-0.5" />
                    <div>
                      <Label htmlFor="mode-hybrid" className="text-sm font-medium cursor-pointer">Híbrido</Label>
                      <p className="text-xs text-muted-foreground">
                        Automações seguem as transições configuradas. Mudanças manuais são livres.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
                {saving === 'STATUS_TRANSITION_MODE' && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              <ArrowRightLeft className="h-5 w-5 mx-auto mb-2 text-muted-foreground/40" />
              Parâmetro <code className="text-xs font-mono">STATUS_TRANSITION_MODE</code> não encontrado na base de dados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
