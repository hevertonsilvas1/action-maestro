
-- =============================================
-- SISTEMA DE PERMISSÕES
-- =============================================

-- 1. Tabela de perfis de permissão
CREATE TABLE public.permission_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read permission_profiles"
  ON public.permission_profiles FOR SELECT TO authenticated
  USING (is_authenticated_user());

CREATE POLICY "Admins can insert permission_profiles"
  ON public.permission_profiles FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update permission_profiles"
  ON public.permission_profiles FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete permission_profiles"
  ON public.permission_profiles FOR DELETE TO authenticated
  USING (is_admin());

CREATE TRIGGER update_permission_profiles_updated_at
  BEFORE UPDATE ON public.permission_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Permissões por perfil
CREATE TABLE public.profile_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, permission)
);

ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read profile_permissions"
  ON public.profile_permissions FOR SELECT TO authenticated
  USING (is_authenticated_user());

CREATE POLICY "Admins can insert profile_permissions"
  ON public.profile_permissions FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update profile_permissions"
  ON public.profile_permissions FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete profile_permissions"
  ON public.profile_permissions FOR DELETE TO authenticated
  USING (is_admin());

-- 3. Overrides individuais por usuário
CREATE TABLE public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own overrides"
  ON public.user_permission_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all overrides"
  ON public.user_permission_overrides FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert overrides"
  ON public.user_permission_overrides FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update overrides"
  ON public.user_permission_overrides FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete overrides"
  ON public.user_permission_overrides FOR DELETE TO authenticated
  USING (is_admin());

-- 4. Adicionar profile_id na tabela user_roles
ALTER TABLE public.user_roles
  ADD COLUMN profile_id uuid REFERENCES public.permission_profiles(id);

-- 5. Função para buscar permissões efetivas do usuário
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY(
    SELECT DISTINCT permission FROM (
      -- Permissões do perfil (exceto as negadas por override)
      SELECT pp.permission
      FROM public.profile_permissions pp
      JOIN public.user_roles ur ON ur.profile_id = pp.profile_id
      WHERE ur.user_id = _user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id = _user_id AND upo.permission = pp.permission AND upo.granted = false
      )
      UNION
      -- Permissões concedidas individualmente via override
      SELECT upo.permission
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = _user_id AND upo.granted = true
    ) combined
  ), ARRAY[]::text[])
$$;

-- 6. Função para checar permissão individual (para uso em RLS)
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _permission = ANY(public.get_user_permissions(_user_id))
$$;

-- 7. Seed: perfis iniciais
INSERT INTO public.permission_profiles (name, slug, description) VALUES
  ('Administrador', 'admin', 'Acesso total ao sistema'),
  ('Operador', 'operador', 'Opera ganhadores e fluxo do dia a dia'),
  ('Financeiro', 'financeiro', 'Gerencia lotes, pagamentos e dashboard financeiro');

-- 8. Seed: permissões do Administrador (todas)
WITH p AS (SELECT id FROM public.permission_profiles WHERE slug = 'admin')
INSERT INTO public.profile_permissions (profile_id, permission)
SELECT p.id, unnest(ARRAY[
  'ganhador.ver','ganhador.criar','ganhador.editar','ganhador.importar','ganhador.excluir',
  'ganhador.solicitar_pix','ganhador.reenviar_pix','ganhador.alterar_status','ganhador.forcar_pix',
  'ganhador.gerar_lote','ganhador.marcar_pago','ganhador.anexar_comprovante','ganhador.enviar_comprovante',
  'acao.ver','acao.criar','acao.editar','acao.ativar','acao.finalizar',
  'financeiro.ver_dashboard','financeiro.ver_lotes','financeiro.exportar_lote',
  'config.ver','config.editar','config.gerenciar_status','config.gerenciar_automacoes','config.gerenciar_mensagens',
  'usuario.ver','usuario.criar','usuario.editar','usuario.gerenciar_permissoes'
]) FROM p;

-- 9. Seed: permissões do Operador
WITH p AS (SELECT id FROM public.permission_profiles WHERE slug = 'operador')
INSERT INTO public.profile_permissions (profile_id, permission)
SELECT p.id, unnest(ARRAY[
  'ganhador.ver','ganhador.criar','ganhador.editar','ganhador.importar',
  'ganhador.solicitar_pix','ganhador.reenviar_pix','ganhador.alterar_status',
  'ganhador.anexar_comprovante','ganhador.enviar_comprovante',
  'acao.ver'
]) FROM p;

-- 10. Seed: permissões do Financeiro
WITH p AS (SELECT id FROM public.permission_profiles WHERE slug = 'financeiro')
INSERT INTO public.profile_permissions (profile_id, permission)
SELECT p.id, unnest(ARRAY[
  'ganhador.ver','ganhador.marcar_pago','ganhador.anexar_comprovante','ganhador.enviar_comprovante',
  'ganhador.gerar_lote',
  'acao.ver',
  'financeiro.ver_dashboard','financeiro.ver_lotes','financeiro.exportar_lote'
]) FROM p;

-- 11. Migrar usuários existentes para perfis
UPDATE public.user_roles
SET profile_id = (SELECT id FROM public.permission_profiles WHERE slug = 'admin')
WHERE role = 'admin';

UPDATE public.user_roles
SET profile_id = (SELECT id FROM public.permission_profiles WHERE slug = 'operador')
WHERE role = 'support';
