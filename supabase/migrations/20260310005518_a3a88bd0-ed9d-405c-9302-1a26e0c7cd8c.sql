
-- Create a function to apply automatic status transitions based on trigger events
-- This is called from Edge Functions when events occur
CREATE OR REPLACE FUNCTION public.apply_automatic_status_transition(
  _winner_id uuid,
  _trigger_event text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_status record;
  current_status text;
  result jsonb;
BEGIN
  -- Get current winner status
  SELECT status::text INTO current_status
  FROM public.winners
  WHERE id = _winner_id AND deleted_at IS NULL;

  IF current_status IS NULL THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'winner_not_found');
  END IF;

  -- Find matching automatic status for this trigger event
  SELECT id, slug, name INTO target_status
  FROM public.winner_statuses
  WHERE trigger_event = _trigger_event
    AND update_mode = 'automatic'
    AND is_active = true
  ORDER BY sort_order
  LIMIT 1;

  IF target_status IS NULL THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'no_matching_status', 'trigger_event', _trigger_event);
  END IF;

  -- Don't change if already at target status
  IF current_status = target_status.slug THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'already_at_status', 'status', current_status);
  END IF;

  -- Apply the transition
  UPDATE public.winners
  SET status = target_status.slug::winner_status,
      status_id = target_status.id,
      updated_at = now()
  WHERE id = _winner_id;

  RETURN jsonb_build_object(
    'changed', true,
    'from', current_status,
    'to', target_status.slug,
    'to_name', target_status.name,
    'trigger_event', _trigger_event
  );
END;
$$;
