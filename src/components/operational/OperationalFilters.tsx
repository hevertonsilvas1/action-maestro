import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, X, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { Action } from '@/types';

export interface OperationalFilterValues {
  search: string;
  status: string;
  actionId: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  prizeType: string;
  pendingType: string; // 'all' | 'pending' | 'completed' | 'error' | 'manual_review'
}

export const INITIAL_FILTERS: OperationalFilterValues = {
  search: '',
  status: 'all',
  actionId: 'all',
  dateFrom: undefined,
  dateTo: undefined,
  prizeType: 'all',
  pendingType: 'all',
};

const PRIZE_TYPE_LABELS: Record<string, string> = {
  main: 'Principal',
  instant: 'Instantâneo',
  spin: 'Giro',
  quota: 'Cota',
  blessed_hour: 'Hora Abençoada',
  bonus: 'Bônus',
};

const PENDING_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'completed', label: 'Concluídos' },
  { value: 'error', label: 'Com Erro' },
  { value: 'manual_review', label: 'Análise Manual' },
];

interface Props {
  filters: OperationalFilterValues;
  onFiltersChange: (f: OperationalFilterValues) => void;
  actionsMap: Record<string, Action>;
}

export function OperationalFilters({ filters, onFiltersChange, actionsMap }: Props) {
  const { activeOrdered } = useWinnerStatusMap();
  const [expanded, setExpanded] = useState(false);

  const update = (partial: Partial<OperationalFilterValues>) =>
    onFiltersChange({ ...filters, ...partial });

  const hasActive = filters.status !== 'all' || filters.actionId !== 'all' ||
    filters.dateFrom || filters.dateTo || filters.prizeType !== 'all' || filters.pendingType !== 'all';

  const clearAll = () => onFiltersChange(INITIAL_FILTERS);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por nome, telefone, CPF..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="max-w-sm h-9 text-sm"
        />
        <Button
          variant={expanded ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="gap-1.5"
        >
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {hasActive && (
            <span className="ml-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">!</span>
          )}
        </Button>
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 text-xs text-muted-foreground">
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <Select value={filters.status} onValueChange={(v) => update({ status: v })}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {activeOrdered.map(s => (
                <SelectItem key={s.slug} value={s.slug}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.actionId} onValueChange={(v) => update({ actionId: v })}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Ações</SelectItem>
              {Object.values(actionsMap).map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.prizeType} onValueChange={(v) => update({ prizeType: v })}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Tipo Prêmio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {Object.entries(PRIZE_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.pendingType} onValueChange={(v) => update({ pendingType: v })}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              {PENDING_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('h-9 text-xs justify-start gap-1.5', !filters.dateFrom && 'text-muted-foreground')}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yy') : 'Data início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => update({ dateFrom: d })} />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

const ERROR_STATUSES = ['pix_refused', 'numero_inexistente', 'cliente_nao_responde'];
const COMPLETED_STATUSES = ['receipt_sent', 'paid'];
const MANUAL_REVIEW_STATUSES = ['receipt_attached', 'pix_received'];

export function applyOperationalFilters<T extends { name: string; status: string; actionId: string; prizeType: string; createdAt: string; phone?: string; cpf?: string; }>(
  winners: T[],
  filters: OperationalFilterValues,
): T[] {
  let result = winners;

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(w =>
      w.name.toLowerCase().includes(q) ||
      w.phone?.includes(q) ||
      w.cpf?.includes(q)
    );
  }

  if (filters.status !== 'all') {
    result = result.filter(w => w.status === filters.status);
  }

  if (filters.actionId !== 'all') {
    result = result.filter(w => w.actionId === filters.actionId);
  }

  if (filters.prizeType !== 'all') {
    result = result.filter(w => w.prizeType === filters.prizeType);
  }

  if (filters.dateFrom) {
    const from = filters.dateFrom.getTime();
    result = result.filter(w => new Date(w.createdAt).getTime() >= from);
  }

  if (filters.dateTo) {
    const to = filters.dateTo.getTime() + 86400000;
    result = result.filter(w => new Date(w.createdAt).getTime() < to);
  }

  if (filters.pendingType === 'error') {
    result = result.filter(w => ERROR_STATUSES.includes(w.status));
  } else if (filters.pendingType === 'completed') {
    result = result.filter(w => COMPLETED_STATUSES.includes(w.status));
  } else if (filters.pendingType === 'manual_review') {
    result = result.filter(w => MANUAL_REVIEW_STATUSES.includes(w.status));
  } else if (filters.pendingType === 'pending') {
    result = result.filter(w => !COMPLETED_STATUSES.includes(w.status) && !ERROR_STATUSES.includes(w.status));
  }

  return result;
}
