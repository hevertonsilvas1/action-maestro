import { AppLayout } from '@/components/AppLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, User, Webhook, Tags, Clock, Zap, Filter } from 'lucide-react';
import { GeneralTab } from '@/components/settings/GeneralTab';
import { UserTab } from '@/components/settings/UserTab';
import { IntegrationsTab } from '@/components/settings/IntegrationsTab';
import { WinnerStatusesTab } from '@/components/settings/WinnerStatusesTab';
import { TimeConfigTab } from '@/components/settings/TimeConfigTab';
import { WindowMessagesTab } from '@/components/settings/WindowMessagesTab';
import { QuickFiltersTab } from '@/components/settings/QuickFiltersTab';
import { useSearchParams } from 'react-router-dom';

export default function SettingsPage() {
  const { isAdmin } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'user';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <AppLayout>
      <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie o sistema, seu perfil e integrações</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full justify-start">
            {isAdmin && (
              <TabsTrigger value="general" className="gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                Geral
              </TabsTrigger>
            )}
            <TabsTrigger value="user" className="gap-1.5">
              <User className="h-3.5 w-3.5" />
              Usuário
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="integrations" className="gap-1.5">
                <Webhook className="h-3.5 w-3.5" />
                Integrações
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="statuses" className="gap-1.5">
                <Tags className="h-3.5 w-3.5" />
                Status
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="time" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Tempo
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="window-messages" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Automações
              </TabsTrigger>
            )}
          </TabsList>

          {isAdmin && (
            <TabsContent value="general">
              <GeneralTab />
            </TabsContent>
          )}

          <TabsContent value="user">
            <UserTab />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="integrations">
              <IntegrationsTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="statuses">
              <WinnerStatusesTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="time">
              <TimeConfigTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="window-messages">
              <WindowMessagesTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
