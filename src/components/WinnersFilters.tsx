import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, Filter, X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WINNER_STATUS_LABELS, type WinnerStatus } from '@/types';
import { isWindowOpen } from '@/lib/time';

export interface WinnersFilterValues {
  search: string;
  status: string;
  actionId: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  valueMin: string;
  valueMax: string;
  whatsappWindow: 'all' | 'open' | 'closed';
}

const INITIAL_FILTERS: WinnersFilterValues = {
  search: '',
  status: 'all',
  actionId: 'all',
  dateFrom: undefined,
  dateTo: undefined,
  valueMin: '',
  valueMax: '',
  whatsappWindow: 'all',
};

interface WinnersFiltersProps {
  filters: WinnersFilterValues;
  onFiltersChange: (filters: WinnersFilterValues) => void;
  /** Map of actionId -> actionName. If omitted, action filter is hidden. */
  actionsMap?: Record<string, string>;
  /** Show value filters (admin only) */
  showValueFilter?: boolean;
}

export function useWinnersFilters() {
  const [filters, setFilters] = useState<WinnersFilterValues>(INITIAL_FILTERS);
  return { filters, setFilters };
}

export function WinnersFilters({
  filters,
  onFiltersChange,
  actionsMap,
  showValueFilter = false,
}: WinnersFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (partial: Partial<WinnersFilterValues>) =>
    onFiltersChange({ ...filters, ...partial });

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.actionId !== 'all' ||
    filters.dateFrom !== undefined ||
    filters.dateTo !== undefined ||
    filters.valueMin !== '' ||
    filters.valueMax !== '' ||
    filters.whatsappWindow !== 'all';

  const clearAll = () =>
    onFiltersChange({ ...INITIAL_FILTERS, search: filters.search });

  const actionEntries = actionsMap
    ? Object.entries(actionsMap).sort((a, b) => a[1].localeCompare(b[1]))
    : [];

  return (
    <div className="space-y-3">
      {/* Search + toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou CPF..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-9 h-9"
          />
        </div>
        <Button
          variant={hasActiveFilters ? 'default' : 'outline'}
          size="sm"
          className="h-9"
          onClick={() => setExpanded(!expanded)}
        >
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          Filtrar
          {hasActiveFilters && (
            <span className="ml-1.5 rounded-full bg-primary-foreground text-primary text-[10px] font-bold px-1.5 py-0.5">
              !
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearAll}>
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div className="rounded-xl border bg-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Status</label>
            <Select value={filters.status} onValueChange={(v) => update({ status: v })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(Object.entries(WINNER_STATUS_LABELS) as [WinnerStatus, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action (only when actionsMap provided) */}
          {actionsMap && actionEntries.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Ação</label>
              <Select value={filters.actionId} onValueChange={(v) => update({ actionId: v })}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {actionEntries.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date From */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Data início</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-9 justify-start text-left text-xs font-normal',
                    !filters.dateFrom && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                  {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(d) => update({ dateFrom: d })}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Data fim</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-9 justify-start text-left text-xs font-normal',
                    !filters.dateTo && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                  {filters.dateTo ? format(filters.dateTo, 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(d) => update({ dateTo: d })}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* WhatsApp Window */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Janela WhatsApp</label>
            <Select value={filters.whatsappWindow} onValueChange={(v) => update({ whatsappWindow: v as 'all' | 'open' | 'closed' })}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Aberta</SelectItem>
                <SelectItem value="closed">Fechada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Value Min/Max (admin only) */}
          {showValueFilter && (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Valor mínimo (R$)</label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={filters.valueMin}
                  onChange={(e) => update({ valueMin: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Valor máximo (R$)</label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={filters.valueMax}
                  onChange={(e) => update({ valueMax: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Apply filter values to a list of winners (with optional actionName) */
export function applyWinnersFilters<T extends { name: string; status: string; actionId: string; value: number; prizeDatetime?: string; fullName?: string; actionName?: string; ultimaInteracaoWhatsapp?: string }>(
  winners: T[],
  filters: WinnersFilterValues,
  windowHours = 24
): T[] {
  const searchLower = filters.search.toLowerCase().trim();
  const valueMin = filters.valueMin ? parseFloat(filters.valueMin) : undefined;
  const valueMax = filters.valueMax ? parseFloat(filters.valueMax) : undefined;

  return winners.filter((w) => {
    // Search (name, fullName, actionName, phone, cpf)
    if (searchLower) {
      const searchable = [w.name, w.fullName, w.actionName, (w as any).phone, (w as any).cpf].filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(searchLower)) return false;
    }
    // Status
    if (filters.status !== 'all' && w.status !== filters.status) return false;
    // Action
    if (filters.actionId !== 'all' && w.actionId !== filters.actionId) return false;
    // Date
    if (filters.dateFrom || filters.dateTo) {
      const d = w.prizeDatetime ? new Date(w.prizeDatetime) : null;
      if (!d) return false;
      if (filters.dateFrom && d < filters.dateFrom) return false;
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
    }
    // Value
    if (valueMin !== undefined && w.value < valueMin) return false;
    if (valueMax !== undefined && w.value > valueMax) return false;

    // WhatsApp Window
    if (filters.whatsappWindow !== 'all') {
      const hasInteraction = !!w.ultimaInteracaoWhatsapp;
      if (filters.whatsappWindow === 'open') {
        if (!hasInteraction || !isWindowOpen(w.ultimaInteracaoWhatsapp, windowHours)) return false;
      } else {
        if (!hasInteraction || isWindowOpen(w.ultimaInteracaoWhatsapp, windowHours)) return false;
      }
    }

    return true;
  });
}
