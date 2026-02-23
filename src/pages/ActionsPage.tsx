import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { useActions } from '@/hooks/useActions';
import { formatCurrency, formatPercent, formatDate, formatNumber } from '@/lib/format';
import { ACTION_STATUS_LABELS, ACTION_STATUS_COLORS } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, ArrowUpDown, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';

export default function ActionsPage() {
  const [search, setSearch] = useState('');
  const { data: actions = [], isLoading } = useActions();

  const filtered = actions.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <AppHeader
        title="Ações"
        subtitle={`${actions.length} ações cadastradas`}
        actions={
          <Link to="/actions/new">
            <Button size="sm" className="gradient-primary text-primary-foreground hover:opacity-90 h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nova Ação
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ações..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Filtrar
            </Button>
            <Button variant="outline" size="sm" className="h-9">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              Ordenar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            {search ? 'Nenhuma ação encontrada.' : 'Nenhuma ação cadastrada ainda.'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Ação</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Cotas</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Vlr Cota</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Receita</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Custo Plan.</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Lucro</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Margem</th>
                    <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((action, i) => {
                    const progress = action.winnersCount > 0
                      ? (action.paidCount / action.winnersCount) * 100
                      : 0;
                    return (
                      <tr
                        key={action.id}
                        className="border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="px-4 py-3">
                          <Link to={`/actions/${action.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                            {action.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={action.status} labels={ACTION_STATUS_LABELS} colors={ACTION_STATUS_COLORS} />
                        </td>
                        <td className="px-4 py-3 text-right text-sm">{formatNumber(action.quotaCount)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatCurrency(action.quotaValue)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatCurrency(action.expectedRevenue)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatCurrency(action.totalCost)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-success">
                          {formatCurrency(action.grossProfit)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">{formatPercent(action.marginPercent)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Progress value={progress} className="h-1.5 w-20" />
                            <span className="text-[10px] text-muted-foreground w-8 text-right">{progress.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((action, i) => {
                const progress = action.winnersCount > 0
                  ? (action.paidCount / action.winnersCount) * 100
                  : 0;
                return (
                  <Link
                    key={action.id}
                    to={`/actions/${action.id}`}
                    className="block rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-card-hover animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-semibold">{action.name}</p>
                      <StatusBadge status={action.status} labels={ACTION_STATUS_LABELS} colors={ACTION_STATUS_COLORS} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <p className="text-muted-foreground">Receita</p>
                        <p className="font-medium">{formatCurrency(action.expectedRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lucro</p>
                        <p className="font-semibold text-success">{formatCurrency(action.grossProfit)}</p>
                      </div>
                    </div>
                    {action.winnersCount > 0 && (
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground">{action.paidCount}/{action.winnersCount}</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
