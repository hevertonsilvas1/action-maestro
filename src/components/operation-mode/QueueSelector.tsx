import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ChevronRight } from 'lucide-react';
import type { WinnerStatusConfig } from '@/hooks/useWinnerStatuses';
import type { Winner } from '@/types';

interface QueueSelectorProps {
  queues: Record<string, Winner[]>;
  activeOrdered: WinnerStatusConfig[];
  onSelectQueue: (statusSlug: string) => void;
}

export function QueueSelector({ queues, activeOrdered, onSelectQueue }: QueueSelectorProps) {
  // Only show statuses that have winners
  const availableQueues = activeOrdered.filter(s => (queues[s.slug]?.length || 0) > 0);
  const emptyQueues = activeOrdered.filter(s => (queues[s.slug]?.length || 0) === 0);

  if (availableQueues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Users className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">Nenhuma fila disponível</p>
        <p className="text-sm">Não há ganhadores para processar no momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableQueues.map(status => {
          const count = queues[status.slug]?.length || 0;
          return (
            <Card
              key={status.id}
              className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] border-l-4"
              style={{ borderLeftColor: status.color }}
              onClick={() => onSelectQueue(status.slug)}
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">{status.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="text-xs font-bold px-2 py-0.5"
                      style={{ backgroundColor: `${status.color}20`, color: status.color }}
                    >
                      {count} ganhador{count !== 1 ? 'es' : ''}
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {emptyQueues.length > 0 && (
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Filas vazias</p>
          <div className="flex flex-wrap gap-2">
            {emptyQueues.map(status => (
              <Badge key={status.id} variant="outline" className="text-xs opacity-50">
                {status.name} (0)
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
