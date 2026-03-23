import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DraftBannerProps {
  onRestore: () => void;
  onDiscard: () => void;
}

export function DraftBanner({ onRestore, onDiscard }: DraftBannerProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
          <p className="text-sm font-medium text-foreground">
            Encontramos um rascunho não salvo. Deseja restaurar?
          </p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onDiscard} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Descartar
          </Button>
          <Button size="sm" onClick={onRestore} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar rascunho
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DraftStatusIndicatorProps {
  status: 'idle' | 'saving' | 'saved';
}

export function DraftStatusIndicator({ status }: DraftStatusIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <span className={cn('text-xs text-muted-foreground animate-in fade-in')}>
      {status === 'saving' ? 'Salvando rascunho...' : '✓ Rascunho salvo automaticamente'}
    </span>
  );
}
