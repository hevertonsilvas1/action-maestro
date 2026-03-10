
CREATE OR REPLACE FUNCTION public.check_prize_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  planned_qty integer;
  current_count integer;
BEGIN
  -- Get total planned quantity for this prize type in this action
  SELECT COALESCE(SUM(quantity), 0) INTO planned_qty
  FROM public.prizes
  WHERE action_id = NEW.action_id
    AND type = NEW.prize_type;

  -- If no prizes planned for this type, allow (no limit configured)
  IF planned_qty = 0 THEN
    RETURN NEW;
  END IF;

  -- Count existing winners of this prize type in this action (excluding soft-deleted)
  SELECT COUNT(*) INTO current_count
  FROM public.winners
  WHERE action_id = NEW.action_id
    AND prize_type = NEW.prize_type
    AND deleted_at IS NULL
    AND id IS DISTINCT FROM NEW.id;

  IF current_count >= planned_qty THEN
    RAISE EXCEPTION 'Limite de premiação atingido para o tipo "%" nesta ação. Previsto: %, Utilizado: %.',
      NEW.prize_type, planned_qty, current_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER check_prize_limit_before_insert
  BEFORE INSERT ON public.winners
  FOR EACH ROW
  EXECUTE FUNCTION public.check_prize_limit();
