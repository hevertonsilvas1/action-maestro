import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { useActions } from '@/hooks/useActions';
import { formatPhone } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TablePagination, paginateArray } from '@/components/TablePagination';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { insertAuditLog } from '@/hooks/useAuditLogger';
import { toast } from 'sonner';
import type { Winner } from '@/types';

function mapWinner(row: any): Winner & { deletedAt: string; deletedBy: string } {
  return {
    id: row.id,
    actionId: row.action_id,
    name: row.name,
    prizeType: row.prize_type,
    prizeTitle: row.prize_title,
    value: Number(row.value),
    status: row.status,
    phone: row.phone ?? undefined,
    cpf: row.cpf ?? undefined,
    fullName: row.full_name ?? undefined,
    receiptVersion: row.receipt_version ?? 0,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by ?? 'Desconhecido',
    pixKey: row.pix_key ?? undefined,
    pixType: row.pix_type ?? undefined,
    ultimaInteracaoWhatsapp: row.ultima_interacao_whatsapp ?? undefined,
    lastOutboundAt: row.last_outbound_at ?? undefined,
  } as any;
}

export default function DeletedWinnersPage() {
  const [restoring, setRestoring] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const queryClient = useQueryClient();
  const { data: actions = [] } = useActions();

  const actionsMap = useMemo(() => {
    const map: Record<string, string> = {};
    actions.forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [actions]);

  const { data: deletedWinners = [], isLoading } = useQuery({
    queryKey: ['winners', 'deleted'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('winners')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapWinner);
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return deletedWinners;
    return deletedWinners.filter((w: any) => {
      const searchable = [w.name, w.fullName, w.phone, w.cpf, actionsMap[w.actionId], w.deletedBy]
        .filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }, [deletedWinners, search, actionsMap]);

  const paginated = useMemo(
    () => paginateArray(filtered, page, pageSize),
    [filtered, page, pageSize]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleRestore = async (winner: any) => {
    setRestoring(winner.id);
    try {
      const { error } = await supabase
        .from('winners')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', winner.id);
      if (error) throw error;

      await insertAuditLog({
        actionId: winner.actionId,
        actionName: actionsMap[winner.actionId] || '',
        tableName: 'winners',
        recordId: winner.id,
        operation: 'RESTORE_WINNER',
        changes: {
          winner_name: winner.name,
          previous_deleted_at: winner.deletedAt,
          previous_deleted_by: winner.deletedBy,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['winners'] });
      toast.success(`${winner.name} restaurado com sucesso.`);
    } catch (err) {
      toast.error('Erro ao restaurar ganhador.');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <AppLayout>
      <AppHeader
        title="Ganhadores Excluídos"
        subtitle={`${deletedWinners.length} registros excluídos`}
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, CPF ou responsável..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            {search ? 'Nenhum resultado encontrado.' : 'Nenhum ganhador excluído.'}
          </div>
        ) : (
          <>
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Nome</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Telefone</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Ação</th>
                      <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Excluído em</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Excluído por</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((w: any) => (
                      <tr key={w.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{w.name}</p>
                          {w.fullName && w.fullName !== w.name && (
                            <p className="text-[10px] text-muted-foreground">{w.fullName}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{formatPhone(w.phone)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{actionsMap[w.actionId] || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={w.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {w.deletedAt
                            ? new Date(w.deletedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{w.deletedBy}</td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={restoring === w.id}
                            onClick={() => handleRestore(w)}
                          >
                            {restoring === w.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            )}
                            Restaurar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
}
