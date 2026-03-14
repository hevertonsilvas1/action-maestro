import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { useWinners } from '@/hooks/useWinners';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';
import { QueueSelector } from '@/components/operation-mode/QueueSelector';
import { Loader2 } from 'lucide-react';
import type { Winner } from '@/types';

export default function OperationModePage() {
  const { data: winners = [], isLoading: winnersLoading } = useWinners();
  const { activeOrdered, isLoading: statusLoading } = useWinnerStatusMap();
  const navigate = useNavigate();

  const queues = useMemo(() => {
    const map: Record<string, Winner[]> = {};
    winners.forEach(w => {
      if (!map[w.status]) map[w.status] = [];
      map[w.status].push(w);
    });
    return map;
  }, [winners]);

  const handleSelectQueue = (statusSlug: string) => {
    navigate(`/winners?status=${encodeURIComponent(statusSlug)}`);
  };

  const isLoading = winnersLoading || statusLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <AppHeader title="Modo Operação" subtitle="Central de acesso rápido às filas de trabalho" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AppHeader
        title="Modo Operação"
        subtitle="Selecione uma fila para abrir a tela de Ganhadores filtrada"
      />
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <QueueSelector
          queues={queues}
          activeOrdered={activeOrdered}
          onSelectQueue={handleSelectQueue}
        />
      </div>
    </AppLayout>
  );
}
