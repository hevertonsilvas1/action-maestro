
-- Create window_messages table
CREATE TABLE public.window_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL,
  type varchar(50) NOT NULL,
  content text NOT NULL,
  unnichat_trigger_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  allow_variables boolean NOT NULL DEFAULT false,
  auto_use boolean NOT NULL DEFAULT false,
  usage_condition varchar(100),
  trigger_rule varchar(100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.window_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies: only admins can manage, authenticated can read
CREATE POLICY "Admins can insert window_messages" ON public.window_messages
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update window_messages" ON public.window_messages
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can delete window_messages" ON public.window_messages
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Authenticated can read window_messages" ON public.window_messages
  FOR SELECT TO authenticated USING (public.is_authenticated_user());

-- Auto-update updated_at
CREATE TRIGGER update_window_messages_updated_at
  BEFORE UPDATE ON public.window_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
