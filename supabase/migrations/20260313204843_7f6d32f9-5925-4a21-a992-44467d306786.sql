
-- Fix sync trigger to handle custom statuses not in the enum
-- When status_id is changed to a custom status (not in enum), keep the current enum value
CREATE OR REPLACE FUNCTION public.sync_winner_status_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_slug text;
  enum_exists boolean;
BEGIN
  -- If status (enum) changed, sync status_id
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT id INTO NEW.status_id
    FROM public.winner_statuses
    WHERE slug = NEW.status::text
    LIMIT 1;
  END IF;
  
  -- If status_id changed (and status didn't), try to sync status enum
  IF NEW.status_id IS DISTINCT FROM OLD.status_id AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    SELECT slug INTO new_slug
    FROM public.winner_statuses
    WHERE id = NEW.status_id;
    
    IF new_slug IS NOT NULL THEN
      -- Check if slug exists in the enum before casting
      SELECT EXISTS(
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'public.winner_status'::regtype 
        AND enumlabel = new_slug
      ) INTO enum_exists;
      
      IF enum_exists THEN
        NEW.status = new_slug::winner_status;
      END IF;
      -- If not in enum, keep old status value - status_id is the source of truth
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
