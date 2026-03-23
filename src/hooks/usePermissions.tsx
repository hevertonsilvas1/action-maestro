import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/** All permission keys in the system */
export const PERMISSIONS = {
  // Ganhadores
  GANHADOR_VER: 'ganhador.ver',
  GANHADOR_CRIAR: 'ganhador.criar',
  GANHADOR_EDITAR: 'ganhador.editar',
  GANHADOR_IMPORTAR: 'ganhador.importar',
  GANHADOR_EXCLUIR: 'ganhador.excluir',
  // Fluxo operacional
  GANHADOR_SOLICITAR_PIX: 'ganhador.solicitar_pix',
  GANHADOR_REENVIAR_PIX: 'ganhador.reenviar_pix',
  GANHADOR_ALTERAR_STATUS: 'ganhador.alterar_status',
  GANHADOR_FORCAR_PIX: 'ganhador.forcar_pix',
  GANHADOR_GERAR_LOTE: 'ganhador.gerar_lote',
  GANHADOR_MARCAR_PAGO: 'ganhador.marcar_pago',
  GANHADOR_ANEXAR_COMPROVANTE: 'ganhador.anexar_comprovante',
  GANHADOR_ENVIAR_COMPROVANTE: 'ganhador.enviar_comprovante',
  // Ações
  ACAO_VER: 'acao.ver',
  ACAO_CRIAR: 'acao.criar',
  ACAO_EDITAR: 'acao.editar',
  ACAO_ATIVAR: 'acao.ativar',
  ACAO_FINALIZAR: 'acao.finalizar',
  // Financeiro
  FINANCEIRO_VER_DASHBOARD: 'financeiro.ver_dashboard',
  FINANCEIRO_VER_LOTES: 'financeiro.ver_lotes',
  FINANCEIRO_EXPORTAR_LOTE: 'financeiro.exportar_lote',
  // Configurações
  CONFIG_VER: 'config.ver',
  CONFIG_EDITAR: 'config.editar',
  CONFIG_GERENCIAR_STATUS: 'config.gerenciar_status',
  CONFIG_GERENCIAR_AUTOMACOES: 'config.gerenciar_automacoes',
  CONFIG_GERENCIAR_MENSAGENS: 'config.gerenciar_mensagens',
  // Usuários
  USUARIO_VER: 'usuario.ver',
  USUARIO_CRIAR: 'usuario.criar',
  USUARIO_EDITAR: 'usuario.editar',
  USUARIO_GERENCIAR_PERMISSOES: 'usuario.gerenciar_permissoes',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Permission group labels for UI display */
export const PERMISSION_GROUPS: Record<string, { label: string; permissions: { key: Permission; label: string }[] }> = {
  ganhadores: {
    label: 'Ganhadores',
    permissions: [
      { key: 'ganhador.ver', label: 'Visualizar ganhadores' },
      { key: 'ganhador.criar', label: 'Criar ganhadores' },
      { key: 'ganhador.editar', label: 'Editar ganhadores' },
      { key: 'ganhador.importar', label: 'Importar ganhadores' },
      { key: 'ganhador.excluir', label: 'Excluir ganhadores' },
    ],
  },
  fluxo: {
    label: 'Fluxo Operacional',
    permissions: [
      { key: 'ganhador.solicitar_pix', label: 'Solicitar PIX' },
      { key: 'ganhador.reenviar_pix', label: 'Reenviar PIX' },
      { key: 'ganhador.alterar_status', label: 'Alterar status' },
      { key: 'ganhador.forcar_pix', label: 'Forçar PIX' },
      { key: 'ganhador.gerar_lote', label: 'Gerar lote PIX' },
      { key: 'ganhador.marcar_pago', label: 'Marcar como pago' },
      { key: 'ganhador.anexar_comprovante', label: 'Anexar comprovante' },
      { key: 'ganhador.enviar_comprovante', label: 'Enviar comprovante' },
    ],
  },
  acoes: {
    label: 'Ações',
    permissions: [
      { key: 'acao.ver', label: 'Visualizar ações' },
      { key: 'acao.criar', label: 'Criar ações' },
      { key: 'acao.editar', label: 'Editar ações' },
      { key: 'acao.ativar', label: 'Ativar ações' },
      { key: 'acao.finalizar', label: 'Finalizar ações' },
    ],
  },
  financeiro: {
    label: 'Financeiro',
    permissions: [
      { key: 'financeiro.ver_dashboard', label: 'Ver dashboard financeiro' },
      { key: 'financeiro.ver_lotes', label: 'Ver lotes' },
      { key: 'financeiro.exportar_lote', label: 'Exportar lote' },
    ],
  },
  config: {
    label: 'Configurações',
    permissions: [
      { key: 'config.ver', label: 'Ver configurações' },
      { key: 'config.editar', label: 'Editar configurações' },
      { key: 'config.gerenciar_status', label: 'Gerenciar status' },
      { key: 'config.gerenciar_automacoes', label: 'Gerenciar automações' },
      { key: 'config.gerenciar_mensagens', label: 'Gerenciar mensagens' },
    ],
  },
  usuarios: {
    label: 'Usuários',
    permissions: [
      { key: 'usuario.ver', label: 'Ver usuários' },
      { key: 'usuario.criar', label: 'Criar usuários' },
      { key: 'usuario.editar', label: 'Editar usuários' },
      { key: 'usuario.gerenciar_permissoes', label: 'Gerenciar permissões' },
    ],
  },
};

interface PermissionsContextType {
  permissions: string[];
  profileSlug: string | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
  canAll: (...permissions: Permission[]) => boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!user) {
      setPermissions([]);
      setProfileSlug(null);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      const { data: perms, error: permsError } = await supabase
        .rpc('get_user_permissions', { _user_id: user.id });

      if (permsError) {
        console.error('Error fetching permissions:', permsError);
        setPermissions([]);
      } else {
        setPermissions(perms || []);
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('profile_id, permission_profiles!user_roles_profile_id_fkey(slug)')
        .eq('user_id', user.id)
        .maybeSingle();

      const profile = roleData?.permission_profiles as unknown as { slug: string } | null;
      setProfileSlug(profile?.slug ?? null);
    } catch (err) {
      console.error('Error in fetchPermissions:', err);
      setPermissions([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();

    const interval = setInterval(() => {
      if (user) {
        fetchPermissions({ silent: true });
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [fetchPermissions, user]);

  const can = useCallback(
    (permission: Permission) => permissions.includes(permission),
    [permissions]
  );

  const canAny = useCallback(
    (...perms: Permission[]) => perms.some((p) => permissions.includes(p)),
    [permissions]
  );

  const canAll = useCallback(
    (...perms: Permission[]) => perms.every((p) => permissions.includes(p)),
    [permissions]
  );

  return (
    <PermissionsContext.Provider
      value={{ permissions, profileSlug, loading, can, canAny, canAll, refresh: fetchPermissions }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) throw new Error('usePermissions must be used within PermissionsProvider');
  return context;
}
