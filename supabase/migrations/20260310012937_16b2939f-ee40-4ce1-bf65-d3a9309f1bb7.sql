
-- Status history table
CREATE TABLE public.winner_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id uuid NOT NULL REFERENCES public.winners(id) ON DELETE CASCADE,
  from_status_id uuid REFERENCES public.winner_statuses(id) ON DELETE SET NULL,
  to_status_id uuid NOT NULL REFERENCES public.winner_statuses(id) ON DELETE CASCADE,
  change_type varchar(20) NOT NULL DEFAULT 'manual',
  trigger_event varchar(100),
  changed_by_user_id uuid,
  changed_by_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by winner
CREATE INDEX idx_winner_status_history_winner ON public.winner_status_history(winner_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.winner_status_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated can read status history"
  ON public.winner_status_history FOR SELECT TO authenticated
  USING (public.is_authenticated_user());

CREATE POLICY "System can insert status history"
  ON public.winner_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_authenticated_user());

-- Trigger function: auto-log status changes on winners table
CREATE OR REPLACE FUNCTION public.log_winner_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_status_id uuid;
  new_status_id uuid;
  v_change_type text := 'manual';
  v_trigger_event text;
BEGIN
  -- Only act when status actually changed
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Resolve status IDs
  SELECT id INTO old_status_id FROM public.winner_statuses WHERE slug = OLD.status::text LIMIT 1;
  SELECT id INTO new_status_id FROM public.winner_statuses WHERE slug = NEW.status::text LIMIT 1;

  -- Check if the target status is automatic
  SELECT ws.update_mode, ws.trigger_event
  INTO v_change_type, v_trigger_event
  FROM public.winner_statuses ws
  WHERE ws.id = new_status_id;

  INSERT INTO public.winner_status_history (
    winner_id, from_status_id, to_status_id,
    change_type, trigger_event, changed_by_user_id
  ) VALUES (
    NEW.id, old_status_id, new_status_id,
    COALESCE(v_change_type, 'manual'),
    v_trigger_event,
    auth.uid()
  );

  RETURN NEW;
END;
$$;

-- Trigger AFTER update (runs after validation trigger)
CREATE TRIGGER log_status_change
  AFTER UPDATE ON public.winners
  FOR EACH ROW
  EXECUTE FUNCTION public.log_winner_status_change();

-- Also log initial status on INSERT
CREATE OR REPLACE FUNCTION public.log_winner_initial_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status_id uuid;
BEGIN
  SELECT id INTO v_status_id FROM public.winner_statuses WHERE slug = NEW.status::text LIMIT 1;

  IF v_status_id IS NOT NULL THEN
    INSERT INTO public.winner_status_history (
      winner_id, from_status_id, to_status_id,
      change_type, trigger_event, changed_by_user_id
    ) VALUES (
      NEW.id, NULL, v_status_id,
      'automatic', 'winner_created', auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER log_initial_status
  AFTER INSERT ON public.winners
  FOR EACH ROW
  EXECUTE FUNCTION public.log_winner_initial_status();
