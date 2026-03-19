import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PermissionsProvider, usePermissions, PERMISSIONS } from "@/hooks/usePermissions";
import Index from "./pages/Index";
import SupportDashboard from "./pages/SupportDashboard";
import ActionsPage from "./pages/ActionsPage";
import NewActionPage from "./pages/NewActionPage";
import ActionDetailPage from "./pages/ActionDetailPage";
import EditActionPage from "./pages/EditActionPage";
import WinnersPage from "./pages/WinnersPage";
import TeamPage from "./pages/TeamPage";
import SettingsPage from "./pages/SettingsPage";

import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ForcePasswordChangePage from "./pages/ForcePasswordChangePage";
import DeletedWinnersPage from "./pages/DeletedWinnersPage";

import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import { useForcePasswordCheck } from "@/hooks/useForcePasswordCheck";

const queryClient = new QueryClient();

function ForcePasswordGuard({ children }: { children: React.ReactNode }) {
  const { mustChangePassword, loading } = useForcePasswordCheck();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user must change password, redirect (unless already on that page)
  if (mustChangePassword && location.pathname !== '/force-password-change') {
    return <Navigate to="/force-password-change" replace />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <ForcePasswordGuard>{children}</ForcePasswordGuard>;
}

function PermissionRoute({ children, permission }: { children: React.ReactNode; permission: string }) {
  const { user, loading: authLoading } = useAuth();
  const { can, loading: permLoading } = usePermissions();

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!can(permission as any)) return <Navigate to="/" replace />;
  return <ForcePasswordGuard>{children}</ForcePasswordGuard>;
}

function RoleDashboard() {
  const { can, loading } = usePermissions();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return can(PERMISSIONS.FINANCEIRO_VER_DASHBOARD) ? <Index /> : <SupportDashboard />;
}

function AuthOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/force-password-change" element={<AuthOnlyRoute><ForcePasswordChangePage /></AuthOnlyRoute>} />
    <Route path="/" element={<ProtectedRoute><RoleDashboard /></ProtectedRoute>} />
    <Route path="/actions" element={<PermissionRoute permission={PERMISSIONS.ACAO_VER}><ActionsPage /></PermissionRoute>} />
    <Route path="/actions/new" element={<PermissionRoute permission={PERMISSIONS.ACAO_CRIAR}><NewActionPage /></PermissionRoute>} />
    <Route path="/actions/:id" element={<ProtectedRoute><ActionDetailPage /></ProtectedRoute>} />
    <Route path="/actions/:id/edit" element={<PermissionRoute permission={PERMISSIONS.ACAO_EDITAR}><EditActionPage /></PermissionRoute>} />
    <Route path="/winners" element={<PermissionRoute permission={PERMISSIONS.GANHADOR_VER}><WinnersPage /></PermissionRoute>} />
    <Route path="/winners/deleted" element={<PermissionRoute permission={PERMISSIONS.GANHADOR_EXCLUIR}><DeletedWinnersPage /></PermissionRoute>} />
    <Route path="/team" element={<PermissionRoute permission={PERMISSIONS.USUARIO_VER}><TeamPage /></PermissionRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PermissionsProvider>
            <AppRoutes />
          </PermissionsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
