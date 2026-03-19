import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ShieldAlert, Eye, EyeOff } from 'lucide-react';

export default function ForcePasswordChangePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      // Update password via Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;

      // Clear the force_password_change flag
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ force_password_change: false } as any)
          .eq('user_id', user.id);
        if (profileError) throw profileError;
      }

      toast.success('Senha alterada com sucesso!');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-warning" />
          </div>
          <CardTitle className="text-lg">Troca de Senha Obrigatória</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sua senha foi redefinida por um administrador. Por segurança, crie uma nova senha antes de continuar.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pw">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mín. 6 caracteres"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirmar Nova Senha</Label>
              <Input
                id="confirm-pw"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full gradient-primary text-primary-foreground"
              disabled={loading || !password || !confirmPassword}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Alterar Senha e Continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
