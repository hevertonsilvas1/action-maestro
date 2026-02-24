import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Camera, Save, User, Mail, Shield, Calendar, Phone, PenLine, Webhook, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  support: 'Suporte',
};

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  signature: string | null;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileData>({
    display_name: '',
    avatar_url: null,
    phone: '',
    signature: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, phone, signature')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setProfile({
          display_name: data.display_name ?? '',
          avatar_url: data.avatar_url ?? null,
          phone: (data as any).phone ?? '',
          signature: (data as any).signature ?? '',
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: 'Formato inválido', description: 'Use JPG, PNG ou WebP.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo de 2MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Erro ao enviar', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setProfile((p) => ({ ...p, avatar_url: newUrl }));

    // Save URL to profile immediately
    await supabase
      .from('profiles')
      .update({ avatar_url: newUrl })
      .eq('user_id', user.id);

    setUploading(false);
    toast({ title: 'Avatar atualizado!' });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: profile.display_name || null,
        phone: profile.phone || null,
        signature: profile.signature || null,
      } as any)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Perfil atualizado com sucesso!' });
    }
    setSaving(false);
  };

  const initials = (profile.display_name || user?.email || '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (loading || roleLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas informações pessoais</p>
        </div>

        {/* Avatar Section */}
        <Card className="shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Foto de perfil</CardTitle>
            <CardDescription>JPG, PNG ou WebP. Máximo 2MB.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-5">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-border">
                {profile.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="Avatar" />
                ) : null}
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-background" />
                ) : (
                  <Camera className="h-5 w-5 text-background" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{profile.display_name || 'Sem nome'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Editable Fields */}
        <Card className="shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Informações pessoais</CardTitle>
            <CardDescription>Edite seus dados. Email e função são somente leitura.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="display_name" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Nome completo
              </Label>
              <Input
                id="display_name"
                value={profile.display_name ?? ''}
                onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
                maxLength={100}
                placeholder="Seu nome"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email
              </Label>
              <Input value={user?.email ?? ''} disabled className="bg-muted/50" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Função
                </Label>
                <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted/50">
                  <Badge variant="secondary" className="text-xs">
                    {role ? ROLE_LABELS[role] || role : '—'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Conta criada em
                </Label>
                <Input
                  value={
                    user?.created_at
                      ? format(new Date(user.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : '—'
                  }
                  disabled
                  className="bg-muted/50"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Telefone
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="phone"
                value={profile.phone ?? ''}
                onChange={(e) => setProfile((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                maxLength={15}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signature" className="flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
                Assinatura interna
                <span className="text-xs text-muted-foreground">(aparece nos logs)</span>
              </Label>
              <Input
                id="signature"
                value={profile.signature ?? ''}
                onChange={(e) => setProfile((p) => ({ ...p, signature: e.target.value }))}
                maxLength={80}
                placeholder="Ex: João Silva - Operações"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Admin-only: Integrations link */}
        {role === 'admin' && (
          <Card className="shadow-card">
            <CardContent className="p-0">
              <Link
                to="/settings/integrations"
                className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <Webhook className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Integrações</p>
                    <p className="text-xs text-muted-foreground">Webhooks e chaves de API</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
