import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { UserPermissionsDialog } from '@/components/UserPermissionsDialog';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, UserPlus, Shield, Headset, DollarSign, MoreVertical, UserX, UserCheck, KeyRound } from 'lucide-react';

interface TeamMember {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  profileSlug: string | null;
  profileName: string | null;
}

function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, profile_id, permission_profiles!user_roles_profile_id_fkey(slug, name)');
      if (rolesError) throw rolesError;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name');
      if (profilesError) throw profilesError;

      const profileMap: Record<string, string> = {};
      profiles.forEach((p) => {
        profileMap[p.user_id] = p.display_name || 'Sem nome';
      });

      return roles.map((r): TeamMember => {
        const permProfile = r.permission_profiles as unknown as { slug: string; name: string } | null;
        return {
          userId: r.user_id,
          displayName: profileMap[r.user_id] || 'Sem nome',
          email: '',
          role: r.role,
          profileSlug: permProfile?.slug ?? null,
          profileName: permProfile?.name ?? null,
        };
      });
    },
  });
}

function usePermissionProfiles() {
  return useQuery({
    queryKey: ['permission-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permission_profiles')
        .select('id, name, slug, description')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

function useBannedUsers() {
  return useQuery({
    queryKey: ['banned-users'],
    queryFn: async () => {
      const res = await supabase.functions.invoke('manage-user', {
        body: { action: 'list_banned' },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return (res.data?.bannedIds ?? []) as string[];
    },
  });
}

const PROFILE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  admin: Shield,
  operador: Headset,
  financeiro: DollarSign,
};

const PROFILE_COLORS: Record<string, string> = {
  admin: 'bg-primary/10 text-primary border-primary/20',
  operador: 'bg-accent/10 text-accent-foreground border-accent/20',
  financeiro: 'bg-success/10 text-success border-success/20',
};

function TeamMemberCard({
  member,
  isSelf,
  isBanned,
  permProfiles,
  onAction,
  onPermissions,
}: {
  member: TeamMember;
  isSelf: boolean;
  isBanned: boolean;
  permProfiles: { id: string; name: string; slug: string }[];
  onAction: (title: string, description: string, action: () => Promise<void>) => void;
  onPermissions: (member: TeamMember) => void;
}) {
  const Icon = PROFILE_ICONS[member.profileSlug || ''] || Headset;
  const colorClass = PROFILE_COLORS[member.profileSlug || ''] || PROFILE_COLORS.operador;
  const label = member.profileName || member.role;

  return (
    <Card className={`animate-fade-in ${isBanned ? 'opacity-60' : ''}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{member.displayName}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorClass}`}>
              {label}
            </span>
            {isBanned && (
              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border bg-destructive/10 text-destructive border-destructive/20">
                Inativo
              </span>
            )}
          </div>
        </div>

        {!isSelf && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isBanned && (
                <>
                  {permProfiles
                    .filter((p) => p.slug !== member.profileSlug)
                    .map((profile) => (
                      <DropdownMenuItem
                        key={profile.id}
                        onClick={() =>
                          onAction(
                            'Alterar Perfil',
                            `Deseja alterar ${member.displayName} para ${profile.name}?`,
                            async () => {
                              const res = await supabase.functions.invoke('manage-user', {
                                body: { action: 'change_profile', userId: member.userId, profileId: profile.id },
                              });
                              if (res.error) throw new Error(res.error.message);
                              if (res.data?.error) throw new Error(res.data.error);
                              toast.success(`Perfil alterado para ${profile.name}`);
                            }
                          )
                        }
                      >
                        Tornar {profile.name}
                      </DropdownMenuItem>
                    ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      onAction(
                        'Desativar Usuário',
                        `Deseja desativar ${member.displayName}? O usuário não conseguirá mais acessar o sistema.`,
                        async () => {
                          const res = await supabase.functions.invoke('manage-user', {
                            body: { action: 'deactivate', userId: member.userId },
                          });
                          if (res.error) throw new Error(res.error.message);
                          if (res.data?.error) throw new Error(res.data.error);
                          toast.success(res.data?.message || 'Usuário desativado');
                        }
                      )
                    }
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Desativar
                  </DropdownMenuItem>
                </>
              )}
              {isBanned && (
                <DropdownMenuItem
                  onClick={() =>
                    onAction(
                      'Reativar Usuário',
                      `Deseja reativar ${member.displayName}? O usuário poderá acessar o sistema novamente.`,
                      async () => {
                        const res = await supabase.functions.invoke('manage-user', {
                          body: { action: 'reactivate', userId: member.userId },
                        });
                        if (res.error) throw new Error(res.error.message);
                        if (res.data?.error) throw new Error(res.data.error);
                        toast.success(res.data?.message || 'Usuário reativado');
                      }
                    )
                  }
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Reativar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardContent>
    </Card>
  );
}

export default function TeamPage() {
  const { data: members = [], isLoading } = useTeamMembers();
  const { data: bannedIds = [], isLoading: bannedLoading } = useBannedUsers();
  const { data: permProfiles = [] } = usePermissionProfiles();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    profileId: '',
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({ open: false, title: '', description: '', action: async () => {} });

  const [actionLoading, setActionLoading] = useState(false);

  const bannedSet = new Set(bannedIds);
  const activeMembers = members.filter((m) => !bannedSet.has(m.userId));
  const inactiveMembers = members.filter((m) => bannedSet.has(m.userId));

  // Default to operador profile
  const defaultProfileId = permProfiles.find(p => p.slug === 'operador')?.id || '';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.displayName) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    const selectedProfile = permProfiles.find(p => p.id === (form.profileId || defaultProfileId));
    const roleMap: Record<string, string> = { admin: 'admin', operador: 'support', financeiro: 'support' };
    const role = selectedProfile ? (roleMap[selectedProfile.slug] || 'support') : 'support';

    setSaving(true);
    try {
      const res = await supabase.functions.invoke('invite-user', {
        body: {
          email: form.email,
          password: form.password,
          displayName: form.displayName,
          role,
          profileId: form.profileId || defaultProfileId,
        },
      });

      if (res.error) throw new Error(res.error.message || 'Erro ao criar usuário');
      if (res.data?.error) throw new Error(res.data.error);

      toast.success(`Usuário ${form.displayName} criado com sucesso!`);
      setForm({ email: '', password: '', displayName: '', profileId: '' });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['team-members'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar usuário');
    } finally {
      setSaving(false);
    }
  };

  const confirmAction = (title: string, description: string, action: () => Promise<void>) => {
    setConfirmDialog({ open: true, title, description, action });
  };

  const executeAction = async () => {
    setActionLoading(true);
    try {
      await confirmDialog.action();
      qc.invalidateQueries({ queryKey: ['team-members'] });
      qc.invalidateQueries({ queryKey: ['banned-users'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerenciar usuário');
    } finally {
      setActionLoading(false);
      setConfirmDialog((prev) => ({ ...prev, open: false }));
    }
  };

  const loading = isLoading || bannedLoading;

  return (
    <AppLayout>
      <AppHeader
        title="Equipe"
        subtitle={`${activeMembers.length} ativos${inactiveMembers.length > 0 ? ` · ${inactiveMembers.length} inativos` : ''}`}
        actions={
          <Button
            size="sm"
            className="gradient-primary text-primary-foreground hover:opacity-90 h-8 text-xs"
            onClick={() => setShowForm(!showForm)}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Novo Usuário
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* Create User Form */}
        {showForm && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-sm">Criar Novo Usuário</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="usuario@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha inicial</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mín. 6 caracteres"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Perfil</Label>
                  <Select value={form.profileId || defaultProfileId} onValueChange={(v) => setForm({ ...form, profileId: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {permProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" className="gradient-primary text-primary-foreground" disabled={saving}>
                    {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Criar Usuário
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Members List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : activeMembers.length === 0 && inactiveMembers.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Nenhum membro cadastrado.
          </div>
        ) : (
          <>
            {activeMembers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeMembers.map((m) => (
                  <TeamMemberCard
                    key={m.userId}
                    member={m}
                    isSelf={m.userId === user?.id}
                    isBanned={false}
                    permProfiles={permProfiles}
                    onAction={confirmAction}
                  />
                ))}
              </div>
            )}

            {inactiveMembers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <UserX className="h-4 w-4" />
                  Usuários Inativos ({inactiveMembers.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inactiveMembers.map((m) => (
                    <TeamMemberCard
                      key={m.userId}
                      member={m}
                      isSelf={m.userId === user?.id}
                      isBanned={true}
                      permProfiles={permProfiles}
                      onAction={confirmAction}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
