import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, UserPlus, Users, Shield, Headset } from 'lucide-react';

interface TeamMember {
  userId: string;
  displayName: string;
  email: string;
  role: string;
}

function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      // Fetch profiles + roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesError) throw rolesError;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name');
      if (profilesError) throw profilesError;

      const profileMap: Record<string, string> = {};
      profiles.forEach((p) => {
        profileMap[p.user_id] = p.display_name || 'Sem nome';
      });

      return roles.map((r): TeamMember => ({
        userId: r.user_id,
        displayName: profileMap[r.user_id] || 'Sem nome',
        email: '', // not available from profiles
        role: r.role,
      }));
    },
  });
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  support: 'Suporte',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-primary/10 text-primary border-primary/20',
  support: 'bg-accent/10 text-accent-foreground border-accent/20',
};

export default function TeamPage() {
  const { data: members = [], isLoading } = useTeamMembers();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'support' as 'admin' | 'support',
  });

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

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('invite-user', {
        body: {
          email: form.email,
          password: form.password,
          displayName: form.displayName,
          role: form.role,
        },
      });

      if (res.error) {
        throw new Error(res.error.message || 'Erro ao criar usuário');
      }

      if (res.data?.error) {
        throw new Error(res.data.error);
      }

      toast.success(`Usuário ${form.displayName} criado com sucesso!`);
      setForm({ email: '', password: '', displayName: '', role: 'support' });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['team-members'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar usuário');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <AppHeader
        title="Equipe"
        subtitle={`${members.length} membros`}
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
                  <Label>Função</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as 'admin' | 'support' })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="support">Suporte</SelectItem>
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
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Nenhum membro cadastrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => (
              <Card key={m.userId} className="animate-fade-in">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {m.role === 'admin' ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <Headset className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{m.displayName}</p>
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border mt-1 ${ROLE_COLORS[m.role] || ''}`}>
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
