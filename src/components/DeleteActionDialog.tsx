import { useState } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DeleteActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionName: string;
  onConfirm: () => Promise<void>;
  isPending: boolean;
  blockReason?: string | null;
}

export function DeleteActionDialog({
  open, onOpenChange, actionName, onConfirm, isPending, blockReason,
}: DeleteActionDialogProps) {
  const [typed, setTyped] = useState('');
  const canConfirm = typed === actionName && !isPending && !blockReason;

  const handleClose = (v: boolean) => {
    if (!v) setTyped('');
    onOpenChange(v);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir Ação
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {blockReason ? (
              <span className="block text-destructive font-medium">{blockReason}</span>
            ) : (
              <>
                <span className="block">
                  Essa ação será removida permanentemente e não poderá ser recuperada. Todos os prêmios e custos vinculados também serão excluídos.
                </span>
                <span className="block font-medium">
                  Digite o nome da ação para confirmar: <strong className="text-foreground">{actionName}</strong>
                </span>
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Digite o nome da ação..."
                  className="mt-2"
                  autoFocus
                />
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          {!blockReason && (
            <Button
              variant="destructive"
              disabled={!canConfirm}
              onClick={async () => {
                await onConfirm();
                handleClose(false);
              }}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Excluir Permanentemente
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
