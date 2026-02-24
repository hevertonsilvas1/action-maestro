import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, Webhook, Plus, Trash2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface IntegrationConfig {
  id: string;
  key: string;
  value: string;
  label: string | null;
  description: string | null;
  updated_at: string;
}

export default function IntegrationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showNewForm, setShowNewForm] = useState(false);
  const [newConfig, setNewConfig] = useState({ key: '', value: '', label: '', description: '' });
  const [addingNew, setAddingNew] = useState(false);

  const fetchConfigs = async () => {
    const { data, error } = await supabase
      .from('integration_configs')
      .select('*')
      .order('key');

    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    } else {
      setConfigs(data || []);
      const values: Record<string, string> = {};
      (data || []).forEach((c: IntegrationConfig) => {
        values[c.id] = c.value;
      });
      setEditValues(values);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleSave = async (config: IntegrationConfig) => {
    if (!user) return;
    setSaving(config.id);
    const newValue = editValues[config.id] ?? config.value;

    const { error } = await supabase
      .from('integration_configs')
      .update({ value: newValue, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', config.id);

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${config.label || config.key} atualizado!` });
      fetchConfigs();
    }
    setSaving(null);
  };

  const handleAddNew = async () => {
    if (!user || !newConfig.key.trim() || !newConfig.value.trim()) return;
    setAddingNew(true);

    const { error } = await supabase
      .from('integration_configs')
      .insert({
        key: newConfig.key.trim().toUpperCase().replace(/\s+/g, '_'),
        value: newConfig.value.trim(),
        label: newConfig.label.trim() || null,
        description: newConfig.description.trim() || null,
        updated_by: user.id,
      });

    if (error) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configuração adicionada!' });
      setNewConfig({ key: '', value: '', label: '', description: '' });
      setShowNewForm(false);
      fetchConfigs();
    }
    setAddingNew(false);
  };

  const handleDelete = async (config: IntegrationConfig) => {
    const { error } = await supabase
      .from('integration_configs')
      .delete()
      .eq('id', config.id);

    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${config.label || config.key} removido.` });
      fetchConfigs();
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskValue = (value: string) => {
    if (!value) return '';
    if (value.length <= 8) return '••••••••';
    return value.slice(0, 4) + '••••••••' + value.slice(-4);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
            <p className="text-sm text-muted-foreground">Gerencie webhooks e chaves de API</p>
          </div>
        </div>

        {configs.map((config) => (
          <Card key={config.id} className="shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{config.label || config.key}</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {config.key}
                </Badge>
              </div>
              {config.description && (
                <CardDescription>{config.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Valor</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={visibleKeys.has(config.id) ? 'text' : 'password'}
                      value={editValues[config.id] ?? config.value}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [config.id]: e.target.value }))
                      }
                      placeholder="Insira o valor..."
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisibility(config.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {visibleKeys.has(config.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDelete(config)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remover
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(config)}
                  disabled={saving === config.id}
                  className="gap-1.5"
                >
                  {saving === config.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {configs.length === 0 && !showNewForm && (
          <Card className="shadow-card">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma integração configurada.
            </CardContent>
          </Card>
        )}

        <Separator />

        {showNewForm ? (
          <Card className="shadow-card border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nova configuração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Chave (identificador)</Label>
                  <Input
                    value={newConfig.key}
                    onChange={(e) => setNewConfig((p) => ({ ...p, key: e.target.value }))}
                    placeholder="EX: API_KEY_NOME"
                    className="font-mono text-sm"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Nome amigável</Label>
                  <Input
                    value={newConfig.label}
                    onChange={(e) => setNewConfig((p) => ({ ...p, label: e.target.value }))}
                    placeholder="Ex: Chave API do serviço X"
                    maxLength={80}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Descrição (opcional)</Label>
                <Input
                  value={newConfig.description}
                  onChange={(e) => setNewConfig((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Para que serve essa configuração?"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Valor</Label>
                <Input
                  type="password"
                  value={newConfig.value}
                  onChange={(e) => setNewConfig((p) => ({ ...p, value: e.target.value }))}
                  placeholder="Insira o valor da chave/URL..."
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowNewForm(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNew}
                  disabled={addingNew || !newConfig.key.trim() || !newConfig.value.trim()}
                  className="gap-1.5"
                >
                  {addingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button variant="outline" className="w-full gap-2" onClick={() => setShowNewForm(true)}>
            <Plus className="h-4 w-4" />
            Adicionar nova integração
          </Button>
        )}
      </div>
    </AppLayout>
  );
}
