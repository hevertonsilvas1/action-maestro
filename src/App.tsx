import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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
import DeletedWinnersPage from "./pages/DeletedWinnersPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

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
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleDashboard() {
  const { isAdmin, loading } = useUserRole();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return isAdmin ? <Index /> : <SupportDashboard />;
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
    <Route path="/" element={<ProtectedRoute><RoleDashboard /></ProtectedRoute>} />
    <Route path="/actions" element={<AdminRoute><ActionsPage /></AdminRoute>} />
    <Route path="/actions/new" element={<AdminRoute><NewActionPage /></AdminRoute>} />
    <Route path="/actions/:id" element={<ProtectedRoute><ActionDetailPage /></ProtectedRoute>} />
    <Route path="/actions/:id/edit" element={<AdminRoute><EditActionPage /></AdminRoute>} />
    <Route path="/winners" element={<ProtectedRoute><WinnersPage /></ProtectedRoute>} />
    <Route path="/winners/deleted" element={<AdminRoute><DeletedWinnersPage /></AdminRoute>} />
    <Route path="/team" element={<AdminRoute><TeamPage /></AdminRoute>} />
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
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
