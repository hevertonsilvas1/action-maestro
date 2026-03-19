import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PERMISSION_GROUPS, type Permission } from '@/hooks/usePermissions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Check, X, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  displayName: string;
  profileId: string | null;
  profileName: string | null;
}

type OverrideState = 'inherit' | 'allow' | 'deny';

interface OverrideEntry {
  permission: string;
  state: OverrideState;
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  displayName,
  profileId,
  profileName,
}: UserPermissionsDialogProps) {
  const [profilePermissions, setProfilePermissions] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, OverrideState>>({});
  const [initialOverrides, setInitialOverrides] = useState<Record<string, OverrideState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;

    const load = async () => {
      setLoading(true);
      try {
        // 1. Load profile base permissions
        let profilePerms: string[] = [];
        if (profileId) {
          const { data } = await supabase
            .from('profile_permissions')
            .select('permission')
            .eq('profile_id', profileId);
          profilePerms = (data || []).map((r) => r.permission);
        }
        setProfilePermissions(profilePerms);

        // 2. Load current overrides for this user
        const { data: overrideData } = await supabase
          .from('user_permission_overrides')
          .select('permission, granted')
          .eq('user_id', userId);

        const ov: Record<string, OverrideState> = {};
        (overrideData || []).forEach((r) => {
          ov[r.permission] = r.granted ? 'allow' : 'deny';
        });
        setOverrides(ov);
        setInitialOverrides(ov);
      } catch (err) {
        console.error('Error loading permissions:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, userId, profileId]);

  const allPermissions = useMemo(() => {
    const perms: { key: string; label: string; group: string }[] = [];
    Object.entries(PERMISSION_GROUPS).forEach(([, group]) => {
      group.permissions.forEach((p) => {
        perms.push({ key: p.key, label: p.label, group: group.label });
      });
    });
    return perms;
  }, []);

  const getEffectiveState = (permKey: string): { effective: boolean; source: string } => {
    const override = overrides[permKey];
    if (override === 'allow') return { effective: true, source: 'override' };
    if (override === 'deny') return { effective: false, source: 'override' };
    const fromProfile = profilePermissions.includes(permKey);
    return { effective: fromProfile, source: 'profile' };
  };

  const cycleState = (permKey: string) => {
    const current = overrides[permKey] || 'inherit';
    const hasInProfile = profilePermissions.includes(permKey);

    // Cycle: inherit → allow → deny → inherit
    let next: OverrideState;
    if (current === 'inherit') {
      next = hasInProfile ? 'deny' : 'allow';
    } else if (current === 'allow') {
      next = 'deny';
    } else {
      next = 'inherit';
    }

    setOverrides((prev) => {
      const updated = { ...prev };
      if (next === 'inherit') {
        delete updated[permKey];
      } else {
        updated[permKey] = next;
      }
      return updated;
    });
  };

  const hasChanges = useMemo(() => {
    const currentKeys = Object.keys(overrides);
    const initialKeys = Object.keys(initialOverrides);
    if (currentKeys.length !== initialKeys.length) return true;
    return currentKeys.some((k) => overrides[k] !== initialOverrides[k]);
  }, [overrides, initialOverrides]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing overrides for this user
      const { error: delError } = await supabase
        .from('user_permission_overrides')
        .delete()
        .eq('user_id', userId);
      if (delError) throw delError;

      // Insert new overrides
      const rows = Object.entries(overrides).map(([permission, state]) => ({
        user_id: userId,
        permission,
        granted: state === 'allow',
      }));

      if (rows.length > 0) {
        const { error: insError } = await supabase
          .from('user_permission_overrides')
          .insert(rows);
        if (insError) throw insError;
      }

      setInitialOverrides({ ...overrides });
      toast.success(`Permissões de ${displayName} atualizadas. O usuário verá as mudanças em até 1 minuto ou ao atualizar a página.`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  const overrideCount = Object.keys(overrides).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Permissões de {displayName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            Perfil base: <Badge variant="secondary">{profileName || 'Nenhum'}</Badge>
            {overrideCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {overrideCount} ajuste{overrideCount !== 1 ? 's' : ''} individual{overrideCount !== 1 ? 'is' : ''}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-2">
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground border rounded-lg p-3 bg-muted/30">
              <span className="font-medium text-foreground">Legenda:</span>
              <span className="flex items-center gap-1">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted"><Minus className="h-3 w-3" /></span>
                Herda do perfil
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-600"><Check className="h-3 w-3" /></span>
                Permitido individualmente
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-destructive/10 text-destructive"><X className="h-3 w-3" /></span>
                Negado individualmente
              </span>
            </div>

            {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
              <div key={groupKey} className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {group.label}
                </h4>
                <div className="border rounded-lg divide-y">
                  {group.permissions.map((perm) => {
                    const overrideState = overrides[perm.key] || 'inherit';
                    const { effective } = getEffectiveState(perm.key);
                    const inProfile = profilePermissions.includes(perm.key);

                    return (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full shrink-0',
                              effective ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                            )}
                          />
                          <span className="text-sm truncate">{perm.label}</span>
                          {inProfile && overrideState === 'inherit' && (
                            <span className="text-[10px] text-muted-foreground">(perfil)</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => cycleState(perm.key)}
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all shrink-0',
                            overrideState === 'inherit' && 'bg-muted border-border text-muted-foreground hover:bg-muted/80',
                            overrideState === 'allow' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20',
                            overrideState === 'deny' && 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20'
                          )}
                          title={
                            overrideState === 'inherit'
                              ? 'Herdado do perfil — clique para alterar'
                              : overrideState === 'allow'
                                ? 'Permitido individualmente — clique para alterar'
                                : 'Negado individualmente — clique para alterar'
                          }
                        >
                          {overrideState === 'inherit' && <Minus className="h-3.5 w-3.5" />}
                          {overrideState === 'allow' && <Check className="h-3.5 w-3.5" />}
                          {overrideState === 'deny' && <X className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
