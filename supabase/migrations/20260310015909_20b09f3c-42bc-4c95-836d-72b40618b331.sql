
-- Update log_winner_status_change to populate changed_by_name from profiles
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
  v_user_name text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT id INTO old_status_id FROM public.winner_statuses WHERE slug = OLD.status::text LIMIT 1;
  SELECT id INTO new_status_id FROM public.winner_statuses WHERE slug = NEW.status::text LIMIT 1;

  SELECT ws.update_mode, ws.trigger_event
  INTO v_change_type, v_trigger_event
  FROM public.winner_statuses ws WHERE ws.id = new_status_id;

  SELECT public.get_active_status_version(new_status_id) INTO v_version_id;

  -- Fetch display_name from profiles
  IF auth.uid() IS NOT NULL THEN
    SELECT display_name INTO v_user_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  INSERT INTO public.winner_status_history (
    winner_id, from_status_id, to_status_id,
    change_type, trigger_event, changed_by_user_id, changed_by_name, status_version_id
  ) VALUES (
    NEW.id, old_status_id, new_status_id,
    COALESCE(v_change_type, 'manual'),
    v_trigger_event, auth.uid(), v_user_name, v_version_id
  );

  RETURN NEW;
END;
$$;

-- Update log_winner_initial_status too
CREATE OR REPLACE FUNCTION public.log_winner_initial_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status_id uuid;
  v_version_id uuid;
  v_user_name text;
BEGIN
  SELECT id INTO v_status_id FROM public.winner_statuses WHERE slug = NEW.status::text LIMIT 1;

  IF v_status_id IS NOT NULL THEN
    SELECT public.get_active_status_version(v_status_id) INTO v_version_id;

    IF auth.uid() IS NOT NULL THEN
      SELECT display_name INTO v_user_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
    END IF;

    INSERT INTO public.winner_status_history (
      winner_id, from_status_id, to_status_id,
      change_type, trigger_event, changed_by_user_id, changed_by_name, status_version_id
    ) VALUES (
      NEW.id, NULL, v_status_id,
      'automatic', 'winner_created', auth.uid(), v_user_name, v_version_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill existing history entries that have changed_by_user_id but no changed_by_name
UPDATE public.winner_status_history h
SET changed_by_name = p.display_name
FROM public.profiles p
WHERE h.changed_by_user_id = p.user_id
  AND h.changed_by_name IS NULL;
