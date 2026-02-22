import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { mockWinners, mockActions } from '@/data/mock';
import { formatCurrency } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, Download } from 'lucide-react';
import { useState } from 'react';

export default function WinnersPage() {
  const [search, setSearch] = useState('');

  const allWinners = mockWinners.map((w) => ({
    ...w,
    actionName: mockActions.find((a) => a.id === w.actionId)?.name ?? '',
  }));

  const filtered = allWinners.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.actionName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <AppHeader
        title="Ganhadores"
        subtitle={`${allWinners.length} ganhadores registrados`}
        actions={
          <Button size="sm" variant="outline" className="h-8 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ganhadores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filtrar
          </Button>
        </div>

        {/* Desktop */}
        <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Nome</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Ação</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Prêmio</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Valor</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Chave Pix</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w, i) => (
                  <tr
                    key={w.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors animate-fade-in"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{w.name}</p>
                      {w.fullName && <p className="text-[10px] text-muted-foreground">{w.fullName}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{w.actionName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{w.prizeTitle}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(w.value)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{w.pixKey || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={w.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden space-y-3">
          {filtered.map((w, i) => (
            <div
              key={w.id}
              className="rounded-xl border bg-card p-4 animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-semibold">{w.name}</p>
                  <p className="text-[10px] text-muted-foreground">{w.actionName}</p>
                </div>
                <StatusBadge status={w.status} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{w.prizeTitle}</span>
                <span className="font-medium">{formatCurrency(w.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
