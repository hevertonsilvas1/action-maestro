import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Megaphone,
  Trophy,
  Trash2,
  Users,
  Settings,
  Zap,
  LogOut,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { usePermissions, PERMISSIONS, type Permission } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const mainNav: NavItem[] = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Ações', url: '/actions', icon: Megaphone, permission: PERMISSIONS.ACAO_VER },
  { title: 'Ganhadores', url: '/winners', icon: Trophy, permission: PERMISSIONS.GANHADOR_VER },
  { title: 'Excluídos', url: '/winners/deleted', icon: Trash2, permission: PERMISSIONS.GANHADOR_EXCLUIR },
];

const settingsNav: NavItem[] = [
  { title: 'Equipe', url: '/team', icon: Users, permission: PERMISSIONS.USUARIO_VER },
  { title: 'Configurações', url: '/settings', icon: Settings },
];

const PROFILE_LABELS: Record<string, string> = {
  admin: 'Admin',
  operador: 'Operador',
  financeiro: 'Financeiro',
};

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { can, profileSlug } = usePermissions();
  const { user, signOut } = useAuth();
  const collapsed = state === 'collapsed';

  const visibleMain = mainNav.filter(item => !item.permission || can(item.permission));
  const visibleSettings = settingsNav.filter(item => !item.permission || can(item.permission));

  const profileLabel = profileSlug ? (PROFILE_LABELS[profileSlug] ?? profileSlug) : '—';

  const isActive = (url: string) =>
    url === '/' ? location.pathname === '/' : location.pathname.startsWith(url);

  return (
    <Sidebar className="border-r-0" collapsible="icon">
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight text-sidebar-accent-foreground">
              ActionPay
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] font-semibold uppercase tracking-wider">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] font-semibold uppercase tracking-wider">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSettings.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="rounded-lg bg-sidebar-accent p-3 space-y-2">
            <p className="text-[11px] font-medium text-sidebar-accent-foreground">
              {profileLabel}
            </p>
            <p className="text-[10px] text-sidebar-muted truncate">{user?.email}</p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-destructive"
              onClick={signOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-8 text-muted-foreground hover:text-destructive"
            onClick={signOut}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
