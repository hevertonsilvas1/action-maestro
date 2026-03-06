
-- Function to normalize phone to E.164 format
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  IF raw IS NULL OR raw = '' THEN
    RETURN NULL;
  END IF;
  
  digits := regexp_replace(raw, '\D', '', 'g');
  
  IF digits = '' THEN
    RETURN NULL;
  END IF;
  
  -- Already has country code 55 + DDD (12 or 13 digits)
  IF starts_with(digits, '55') AND (length(digits) = 12 OR length(digits) = 13) THEN
    RETURN '+' || digits;
  END IF;
  
  -- Just DDD + number (10 or 11 digits)
  IF length(digits) = 10 OR length(digits) = 11 THEN
    RETURN '+55' || digits;
  END IF;
  
  -- Already full with + (e.g., passed as +5573...)
  IF length(digits) >= 12 THEN
    RETURN '+' || digits;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Trigger function to auto-populate phone_e164 when phone changes
CREATE OR REPLACE FUNCTION public.auto_populate_phone_e164()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only recalculate if phone changed or phone_e164 is null
  IF NEW.phone IS DISTINCT FROM OLD.phone OR NEW.phone_e164 IS NULL THEN
    NEW.phone_e164 := normalize_phone_e164(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on winners table
DROP TRIGGER IF EXISTS trg_auto_phone_e164 ON public.winners;
CREATE TRIGGER trg_auto_phone_e164
  BEFORE INSERT OR UPDATE OF phone ON public.winners
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_populate_phone_e164();

-- Backfill existing records where phone_e164 is null but phone exists
UPDATE public.winners
SET phone_e164 = normalize_phone_e164(phone)
WHERE phone IS NOT NULL AND phone_e164 IS NULL;
