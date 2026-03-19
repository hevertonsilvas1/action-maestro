
-- Insert the transition mode config
INSERT INTO public.integration_configs (key, value, label, description)
VALUES (
  'STATUS_TRANSITION_MODE',
  'hybrid',
  'Modo de Transição de Status',
  'Controla como as transições de status são validadas: free (livre), controlled (controlado) ou hybrid (híbrido)'
)
ON CONFLICT DO NOTHING;

-- Update the validation function to respect the transition mode
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
  SELECT
    CASE
      -- Free mode: always allow
      WHEN (SELECT value FROM public.integration_configs WHERE key = 'STATUS_TRANSITION_MODE') = 'free'
        THEN true
      -- Controlled mode: strict validation
      WHEN (SELECT value FROM public.integration_configs WHERE key = 'STATUS_TRANSITION_MODE') = 'controlled'
        THEN (
          SELECT EXISTS (
            SELECT 1
            FROM public.winner_status_transitions t
            JOIN public.winner_statuses fs ON fs.id = t.from_status_id
            JOIN public.winner_statuses ts ON ts.id = t.to_status_id
            WHERE fs.slug = _from_status_slug
              AND ts.slug = _to_status_slug
          )
          OR NOT EXISTS (
            SELECT 1
            FROM public.winner_status_transitions t
            JOIN public.winner_statuses fs ON fs.id = t.from_status_id
            WHERE fs.slug = _from_status_slug
          )
        )
      -- Hybrid mode (default): always allow (manual changes bypass validation)
      -- Automations will check transitions in their own code
      ELSE true
    END
$$;
