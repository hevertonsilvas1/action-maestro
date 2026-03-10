
-- Table: status_time_config (threshold configuration for visual indicators)
CREATE TABLE public.status_time_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_minutes integer NOT NULL DEFAULT 10,
  critical_minutes integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.status_time_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read status_time_config" ON public.status_time_config
  FOR SELECT TO authenticated USING (public.is_authenticated_user());
CREATE POLICY "Admins can update status_time_config" ON public.status_time_config
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert status_time_config" ON public.status_time_config
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Insert default config
INSERT INTO public.status_time_config (warning_minutes, critical_minutes) VALUES (10, 30);

-- Table: status_time_rules (automatic rules based on time in status)
CREATE TABLE public.status_time_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  from_status text NOT NULL,
  to_status text NOT NULL,
  time_limit integer NOT NULL,
  time_unit text NOT NULL DEFAULT 'minutes',
  condition_field text,
  condition_description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.status_time_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read status_time_rules" ON public.status_time_rules
  FOR SELECT TO authenticated USING (public.is_authenticated_user());
CREATE POLICY "Admins can insert status_time_rules" ON public.status_time_rules
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update status_time_rules" ON public.status_time_rules
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete status_time_rules" ON public.status_time_rules
  FOR DELETE TO authenticated USING (public.is_admin());
