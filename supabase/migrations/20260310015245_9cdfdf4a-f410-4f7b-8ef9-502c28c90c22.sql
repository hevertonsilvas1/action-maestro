
-- 1. Create winner_status_versions table
CREATE TABLE public.winner_status_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.winner_statuses(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  update_mode varchar(20) NOT NULL DEFAULT 'manual',
  trigger_event varchar(100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(status_id, version)
);

-- 2. Add status_version_id to winner_status_history
ALTER TABLE public.winner_status_history
ADD COLUMN status_version_id uuid REFERENCES public.winner_status_versions(id);

-- 3. Enable RLS on winner_status_versions
ALTER TABLE public.winner_status_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can read status versions"
ON public.winner_status_versions FOR SELECT TO authenticated
USING (public.is_authenticated_user());

CREATE POLICY "Admins can insert status versions"
ON public.winner_status_versions FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update status versions"
ON public.winner_status_versions FOR UPDATE TO authenticated
USING (public.is_admin());

-- 4. Seed initial versions from existing winner_statuses data
INSERT INTO public.winner_status_versions (status_id, version, update_mode, trigger_event, is_active)
SELECT id, 1, update_mode, trigger_event, is_active
FROM public.winner_statuses;

-- 5. Create function to get active version for a status
CREATE OR REPLACE FUNCTION public.get_active_status_version(_status_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.winner_status_versions
  WHERE status_id = _status_id AND is_active = true
  ORDER BY version DESC LIMIT 1;
$$;

-- 6. Update the log_winner_status_change trigger to include version
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
  v_version_id uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT id INTO old_status_id FROM public.winner_statuses WHERE slug = OLD.status::text LIMIT 1;
  SELECT id INTO new_status_id FROM public.winner_statuses WHERE slug = NEW.status::text LIMIT 1;

  SELECT ws.update_mode, ws.trigger_event
  INTO v_change_type, v_trigger_event
  FROM public.winner_statuses ws WHERE ws.id = new_status_id;

  -- Get active version for the target status
  SELECT public.get_active_status_version(new_status_id) INTO v_version_id;

  INSERT INTO public.winner_status_history (
    winner_id, from_status_id, to_status_id,
    change_type, trigger_event, changed_by_user_id, status_version_id
  ) VALUES (
    NEW.id, old_status_id, new_status_id,
    COALESCE(v_change_type, 'manual'),
    v_trigger_event, auth.uid(), v_version_id
  );

  RETURN NEW;
END;
$$;

-- 7. Update log_winner_initial_status to include version
CREATE OR REPLACE FUNCTION public.log_winner_initial_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status_id uuid;
  v_version_id uuid;
BEGIN
  SELECT id INTO v_status_id FROM public.winner_statuses WHERE slug = NEW.status::text LIMIT 1;

  IF v_status_id IS NOT NULL THEN
    SELECT public.get_active_status_version(v_status_id) INTO v_version_id;

    INSERT INTO public.winner_status_history (
      winner_id, from_status_id, to_status_id,
      change_type, trigger_event, changed_by_user_id, status_version_id
    ) VALUES (
      NEW.id, NULL, v_status_id,
      'automatic', 'winner_created', auth.uid(), v_version_id
    );
  END IF;

  RETURN NEW;
END;
$$;
