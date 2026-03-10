
-- Create transitions table for status workflow
CREATE TABLE public.winner_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status_id uuid NOT NULL REFERENCES public.winner_statuses(id) ON DELETE CASCADE,
  to_status_id uuid NOT NULL REFERENCES public.winner_statuses(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_status_id, to_status_id)
);

-- Enable RLS
ALTER TABLE public.winner_status_transitions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can read transitions"
  ON public.winner_status_transitions FOR SELECT TO authenticated
  USING (public.is_authenticated_user());

CREATE POLICY "Admins can insert transitions"
  ON public.winner_status_transitions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete transitions"
  ON public.winner_status_transitions FOR DELETE TO authenticated
  USING (public.is_admin());

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION public.is_valid_status_transition(
  _from_status_slug text,
  _to_status_slug text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.winner_status_transitions t
    JOIN public.winner_statuses fs ON fs.id = t.from_status_id
    JOIN public.winner_statuses ts ON ts.id = t.to_status_id
    WHERE fs.slug = _from_status_slug
      AND ts.slug = _to_status_slug
  )
  -- If no transitions are configured for the source status, allow all
  OR NOT EXISTS (
    SELECT 1
    FROM public.winner_status_transitions t
    JOIN public.winner_statuses fs ON fs.id = t.from_status_id
    WHERE fs.slug = _from_status_slug
  )
$$;
