import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { OperationalMetrics } from '@/components/OperationalMetrics';
import { useWinners } from '@/hooks/useWinners';
import { Loader2 } from 'lucide-react';

export default function SupportDashboard() {
  const { data: winners = [], isLoading } = useWinners();

  if (isLoading) {
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
      <AppHeader
        title="Dashboard Operacional"
        subtitle="Visão geral da fila de trabalho"
      />
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <OperationalMetrics winners={winners} />
      </div>
    </AppLayout>
  );
}
