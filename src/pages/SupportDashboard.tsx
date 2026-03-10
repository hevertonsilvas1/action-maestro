import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { OperationalDashboard } from '@/components/operational/OperationalDashboard';

export default function SupportDashboard() {
  return (
    <AppLayout>
      <AppHeader
        title="Dashboard Operacional"
        subtitle="Visão geral da fila de trabalho e acompanhamento de ganhadores"
      />
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <OperationalDashboard />
      </div>
    </AppLayout>
  );
}
