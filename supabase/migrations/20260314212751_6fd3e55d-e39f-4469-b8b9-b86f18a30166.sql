
CREATE TABLE public.user_quick_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filter_type text NOT NULL DEFAULT 'status',
  filter_value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, filter_type, filter_value)
);

ALTER TABLE public.user_quick_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own quick filters"
  ON public.user_quick_filters FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own quick filters"
  ON public.user_quick_filters FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own quick filters"
  ON public.user_quick_filters FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own quick filters"
  ON public.user_quick_filters FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
