
-- 1. Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'support');

CREATE TYPE public.action_status AS ENUM ('planning', 'active', 'completed', 'cancelled');

CREATE TYPE public.prize_type AS ENUM ('main', 'instant', 'spin', 'quota', 'blessed_hour', 'bonus');

CREATE TYPE public.cost_category AS ENUM ('marketing', 'delivery', 'taxes', 'legalization', 'other');

CREATE TYPE public.winner_status AS ENUM (
  'imported', 'pix_requested', 'awaiting_pix', 'pix_received',
  'ready_to_pay', 'sent_to_batch', 'awaiting_receipt', 'paid', 'receipt_sent'
);

CREATE TYPE public.pix_type AS ENUM ('cpf', 'cnpj', 'email', 'phone', 'random');

-- 2. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'support',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Actions table
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status action_status NOT NULL DEFAULT 'planning',
  expected_revenue NUMERIC NOT NULL DEFAULT 0,
  total_prizes NUMERIC NOT NULL DEFAULT 0,
  total_operational NUMERIC NOT NULL DEFAULT 0,
  total_taxes NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  gross_profit NUMERIC NOT NULL DEFAULT 0,
  margin_percent NUMERIC NOT NULL DEFAULT 0,
  real_paid NUMERIC NOT NULL DEFAULT 0,
  winners_count INTEGER NOT NULL DEFAULT 0,
  paid_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

-- 5. Prizes table
CREATE TABLE public.prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID REFERENCES public.actions(id) ON DELETE CASCADE NOT NULL,
  type prize_type NOT NULL,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_value NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;

-- 6. Costs table
CREATE TABLE public.costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID REFERENCES public.actions(id) ON DELETE CASCADE NOT NULL,
  category cost_category NOT NULL,
  description TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;

-- 7. Winners table
CREATE TABLE public.winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID REFERENCES public.actions(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT,
  prize_type prize_type NOT NULL,
  prize_title TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  status winner_status NOT NULL DEFAULT 'imported',
  pix_key TEXT,
  pix_type pix_type,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;

-- 8. Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- 9. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_actions_updated_at BEFORE UPDATE ON public.actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_prizes_updated_at BEFORE UPDATE ON public.prizes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_costs_updated_at BEFORE UPDATE ON public.costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_winners_updated_at BEFORE UPDATE ON public.winners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. RLS Policies

-- user_roles: only admins can manage, all authenticated can read own
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin());

-- profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- actions: admin full, support read-only
CREATE POLICY "Authenticated can read actions" ON public.actions FOR SELECT TO authenticated USING (public.is_authenticated_user());
CREATE POLICY "Admins can insert actions" ON public.actions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update actions" ON public.actions FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete actions" ON public.actions FOR DELETE TO authenticated USING (public.is_admin());

-- prizes: admin full, support read-only
CREATE POLICY "Authenticated can read prizes" ON public.prizes FOR SELECT TO authenticated USING (public.is_authenticated_user());
CREATE POLICY "Admins can insert prizes" ON public.prizes FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update prizes" ON public.prizes FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete prizes" ON public.prizes FOR DELETE TO authenticated USING (public.is_admin());

-- costs: admin full, support read-only (support reads but won't see financial summaries in UI)
CREATE POLICY "Authenticated can read costs" ON public.costs FOR SELECT TO authenticated USING (public.is_authenticated_user());
CREATE POLICY "Admins can insert costs" ON public.costs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update costs" ON public.costs FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete costs" ON public.costs FOR DELETE TO authenticated USING (public.is_admin());

-- winners: admin full, support can read and update (status/pix/receipt)
CREATE POLICY "Authenticated can read winners" ON public.winners FOR SELECT TO authenticated USING (public.is_authenticated_user());
CREATE POLICY "Admins can insert winners" ON public.winners FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update winners" ON public.winners FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Support can update winners" ON public.winners FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'support'));
CREATE POLICY "Admins can delete winners" ON public.winners FOR DELETE TO authenticated USING (public.is_admin());
