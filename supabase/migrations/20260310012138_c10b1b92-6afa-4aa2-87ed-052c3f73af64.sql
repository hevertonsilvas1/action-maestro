
-- Trigger function to validate status transitions on winners table
CREATE OR REPLACE FUNCTION public.validate_winner_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only validate if status actually changed
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Check if transition is valid using existing function
    IF NOT public.is_valid_status_transition(OLD.status::text, NEW.status::text) THEN
      RAISE EXCEPTION 'Transição de status não permitida: "%" → "%". Configure as transições permitidas em Configurações → Status.',
        OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on winners table (BEFORE UPDATE)
CREATE TRIGGER validate_status_transition
  BEFORE UPDATE ON public.winners
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_winner_status_transition();
