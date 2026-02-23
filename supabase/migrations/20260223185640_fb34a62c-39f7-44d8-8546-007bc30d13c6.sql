
-- 1. Add new columns to actions table
ALTER TABLE public.actions 
  ADD COLUMN IF NOT EXISTS quota_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS tax_percent numeric NOT NULL DEFAULT 0;

-- 2. Configurable prize types (dynamic, not enum)
CREATE TABLE public.prize_type_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prize_type_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read prize types" ON public.prize_type_configs
  FOR SELECT TO authenticated USING (is_authenticated_user());
CREATE POLICY "Admins can insert prize types" ON public.prize_type_configs
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update prize types" ON public.prize_type_configs
  FOR UPDATE TO authenticated USING (is_admin());

-- 3. Configurable cost types (dynamic, not enum)
CREATE TABLE public.cost_type_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_type_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cost types" ON public.cost_type_configs
  FOR SELECT TO authenticated USING (is_authenticated_user());
CREATE POLICY "Admins can insert cost types" ON public.cost_type_configs
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update cost types" ON public.cost_type_configs
  FOR UPDATE TO authenticated USING (is_admin());

-- 4. Add columns to prizes for new structure
ALTER TABLE public.prizes
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS prize_type_config_id uuid REFERENCES public.prize_type_configs(id),
  ADD COLUMN IF NOT EXISTS item_status text NOT NULL DEFAULT 'active';

-- 5. Add columns to costs for quantity/unit_value
ALTER TABLE public.costs
  ADD COLUMN IF NOT EXISTS cost_type_config_id uuid REFERENCES public.cost_type_configs(id),
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_value numeric NOT NULL DEFAULT 0;

-- 6. Audit log for change history
CREATE TABLE public.action_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  record_id uuid,
  operation text NOT NULL,
  changes jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log" ON public.action_audit_log
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can insert audit log" ON public.action_audit_log
  FOR INSERT TO authenticated WITH CHECK (is_admin());

-- 7. Seed default prize types
INSERT INTO public.prize_type_configs (name) VALUES
  ('Cota Super'), ('Giro Abençoado'), ('Caixa Surpresa'),
  ('Menor Cota'), ('Maior Cota'), ('Horário Abençoado'),
  ('Bônus'), ('Instantâneo');

-- 8. Seed default cost types
INSERT INTO public.cost_type_configs (name) VALUES
  ('Marketing'), ('Entrega'), ('Legalização'),
  ('Comissão'), ('Taxas'), ('Outros');

-- 9. Triggers for updated_at on new tables
CREATE TRIGGER update_prize_type_configs_updated_at
  BEFORE UPDATE ON public.prize_type_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cost_type_configs_updated_at
  BEFORE UPDATE ON public.cost_type_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
