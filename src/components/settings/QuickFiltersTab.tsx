import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, Filter, MessageSquare } from 'lucide-react';
import { useQuickFilters } from '@/hooks/useQuickFilters';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';
import { useToast } from '@/hooks/use-toast';

const WINDOW_OPTIONS = [
  { value: 'open', label: 'Janela Aberta' },
  { value: 'closed', label: 'Janela Fechada' },
];

export function QuickFiltersTab() {
  const { filters, isLoading, saveFilters } = useQuickFilters();
  const { activeOrdered, isLoading: statusLoading } = useWinnerStatusMap();
  const { toast } = useToast();

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedWindows, setSelectedWindows] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Initialize from saved data
  useEffect(() => {
    if (isLoading || initialized) return;
    const statuses = new Set<string>();
    const windows = new Set<string>();
    filters.forEach(f => {
      if (f.filter_type === 'status') statuses.add(f.filter_value);
      if (f.filter_type === 'window') windows.add(f.filter_value);
    });
    setSelectedStatuses(statuses);
    setSelectedWindows(windows);
    setInitialized(true);
  }, [filters, isLoading, initialized]);

  const toggleStatus = (slug: string) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleWindow = (value: string) => {
    setSelectedWindows(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedStatuses(new Set(activeOrdered.map(s => s.slug)));
    setSelectedWindows(new Set(WINDOW_OPTIONS.map(w => w.value)));
  };

  const clearAll = () => {
    setSelectedStatuses(new Set());
    setSelectedWindows(new Set());
  };

  const handleSave = async () => {
    const items: { filter_type: string; filter_value: string }[] = [];
    // Add statuses in their display order
    activeOrdered.forEach(s => {
      if (selectedStatuses.has(s.slug)) {
        items.push({ filter_type: 'status', filter_value: s.slug });
      }
    });
    // Add windows
    WINDOW_OPTIONS.forEach(w => {
      if (selectedWindows.has(w.value)) {
        items.push({ filter_type: 'window', filter_value: w.value });
      }
    });

    try {
      await saveFilters.mutateAsync(items);
      toast({ title: 'Filtros rápidos salvos!' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  if (isLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalSelected = selectedStatuses.size + selectedWindows.size;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros Rápidos da Tela de Ganhadores
          </CardTitle>
          <CardDescription>
            Escolha quais chips de filtro rápido ficam visíveis na tela de Ganhadores.
            Isso permite personalizar sua área de trabalho mostrando apenas as filas que você utiliza.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalSelected} filtro{totalSelected !== 1 ? 's' : ''} selecionado{totalSelected !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                Selecionar todos
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7">
                Limpar
              </Button>
            </div>
          </div>

          {/* Status filters */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status de Ganhadores</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeOrdered.map(status => (
                <label
                  key={status.slug}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedStatuses.has(status.slug)}
                    onCheckedChange={() => toggleStatus(status.slug)}
                  />
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-sm">{status.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Window filters */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Janela WhatsApp
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WINDOW_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedWindows.has(opt.value)}
                    onCheckedChange={() => toggleWindow(opt.value)}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saveFilters.isPending} className="gap-2">
              {saveFilters.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar filtros
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
