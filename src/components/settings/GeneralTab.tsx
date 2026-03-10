import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings2 } from 'lucide-react';

export function GeneralTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Configurações Gerais</CardTitle>
              <CardDescription>Parâmetros globais e preferências do sistema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Settings2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">Em breve</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
              Configurações gerais do sistema serão adicionadas aqui conforme novas funcionalidades forem implementadas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
