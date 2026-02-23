import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Megaphone,
  Trophy,
  Users,
  Settings,
  ChevronLeft,
  Zap,
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
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';

const adminMainNav = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Ações', url: '/actions', icon: Megaphone },
  { title: 'Ganhadores', url: '/winners', icon: Trophy },
];

const supportMainNav = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Ganhadores', url: '/winners', icon: Trophy },
];

const adminSettingsNav = [
  { title: 'Equipe', url: '/team', icon: Users },
  { title: 'Configurações', url: '/settings', icon: Settings },
];

const supportSettingsNav = [
  { title: 'Configurações', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { isAdmin } = useUserRole();
  const collapsed = state === 'collapsed';

  const mainNav = isAdmin ? adminMainNav : supportMainNav;
  const settingsNav = isAdmin ? adminSettingsNav : supportSettingsNav;

  const isActive = (url: string) =>
    url === '/' ? location.pathname === '/' : location.pathname.startsWith(url);

  return (
    <Sidebar
      className="border-r-0"
      collapsible="icon"
    >
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
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
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
              {settingsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
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
          <div className="rounded-lg bg-sidebar-accent p-3">
            <p className="text-[11px] font-medium text-sidebar-accent-foreground">
              Admin
            </p>
            <p className="text-[10px] text-sidebar-muted">admin@actionpay.com</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
