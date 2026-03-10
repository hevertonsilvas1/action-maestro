
CREATE OR REPLACE FUNCTION public.check_action_not_planning()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  action_status text;
BEGIN
  SELECT status::text INTO action_status
  FROM public.actions
  WHERE id = NEW.action_id;

  IF action_status = 'planning' THEN
    RAISE EXCEPTION 'Não é possível adicionar ganhadores a uma ação em status "Planejamento". Altere o status da ação antes de iniciar a operação.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER check_action_not_planning_trigger
  BEFORE INSERT ON public.winners
  FOR EACH ROW
  EXECUTE FUNCTION public.check_action_not_planning();
