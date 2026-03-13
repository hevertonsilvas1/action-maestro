import { useState, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { useWinners } from '@/hooks/useWinners';
import { useActions } from '@/hooks/useActions';
import { useWinnerStatusMap } from '@/hooks/useWinnerStatusMap';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { QueueSelector } from '@/components/operation-mode/QueueSelector';
import { QueueProcessor } from '@/components/operation-mode/QueueProcessor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { Winner } from '@/types';

export default function OperationModePage() {
  const { data: winners = [], isLoading: winnersLoading } = useWinners();
  const { data: actions = [] } = useActions();
  const { activeOrdered, isLoading: statusLoading } = useWinnerStatusMap();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();

  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  const actionsMap = useMemo(() => {
    const m: Record<string, typeof actions[0]> = {};
    actions.forEach(a => { m[a.id] = a; });
    return m;
  }, [actions]);

  // Build queues: group winners by status slug
  const queues = useMemo(() => {
    const map: Record<string, Winner[]> = {};
    winners.forEach(w => {
      if (!map[w.status]) map[w.status] = [];
      map[w.status].push(w);
    });
    return map;
  }, [winners]);

  // Current queue winners (excluding processed)
  const queueWinners = useMemo(() => {
    if (!selectedStatus) return [];
    return (queues[selectedStatus] || []).filter(w => !processedIds.has(w.id));
  }, [queues, selectedStatus, processedIds]);

  const totalInQueue = selectedStatus ? (queues[selectedStatus] || []).length : 0;

  const currentWinner = queueWinners[currentIndex] || null;

  const handleSelectQueue = (statusSlug: string) => {
    setSelectedStatus(statusSlug);
    setProcessedIds(new Set());
    setCurrentIndex(0);
  };

  const handleExitQueue = () => {
    setSelectedStatus(null);
    setProcessedIds(new Set());
    setCurrentIndex(0);
  };

  const handleNext = useCallback(() => {
    if (currentWinner) {
      setProcessedIds(prev => new Set(prev).add(currentWinner.id));
    }
    // Index stays 0 since the processed winner gets filtered out
    setCurrentIndex(0);
  }, [currentWinner]);

  const handleSkip = useCallback(() => {
    if (currentIndex < queueWinners.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0); // wrap around
    }
  }, [currentIndex, queueWinners.length]);

  const isLoading = winnersLoading || statusLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <AppHeader title="Modo Operação" subtitle="Fila de processamento operacional" />
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
        subtitle={selectedStatus ? undefined : "Selecione uma fila para iniciar o processamento"}
        actions={
          selectedStatus ? (
            <Button variant="outline" size="sm" onClick={handleExitQueue}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar às filas
            </Button>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {!selectedStatus ? (
          <QueueSelector
            queues={queues}
            activeOrdered={activeOrdered}
            onSelectQueue={handleSelectQueue}
          />
        ) : (
          <QueueProcessor
            winner={currentWinner}
            statusSlug={selectedStatus}
            actionsMap={actionsMap}
            processedCount={processedIds.size}
            totalCount={totalInQueue}
            remainingCount={queueWinners.length}
            onNext={handleNext}
            onSkip={handleSkip}
            isAdmin={isAdmin}
            userName={user?.email || ''}
          />
        )}
      </div>
    </AppLayout>
  );
}
