import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DraftBannerProps {
  onRestore: () => void;
  onDiscard: () => void;
}

export function DraftBanner({ onRestore, onDiscard }: DraftBannerProps) {
  return (
    <Alert className="border-warning bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
        <span className="text-sm font-medium">
          Encontramos um rascunho não salvo. Deseja restaurar?
        </span>
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
      </AlertDescription>
    </Alert>
  );
}

interface DraftStatusIndicatorProps {
  status: 'idle' | 'saving' | 'saved';
}

export function DraftStatusIndicator({ status }: DraftStatusIndicatorProps) {
  if (status === 'idle') return null;
  return (
    <span className="text-xs text-muted-foreground animate-in fade-in">
      {status === 'saving' ? 'Salvando rascunho...' : '✓ Rascunho salvo automaticamente'}
    </span>
  );
}
