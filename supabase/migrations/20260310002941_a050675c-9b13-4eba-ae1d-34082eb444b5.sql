
-- Add status_id column to winners
ALTER TABLE public.winners ADD COLUMN status_id uuid REFERENCES public.winner_statuses(id);

-- Populate status_id from existing status enum by matching slugs
UPDATE public.winners w
SET status_id = ws.id
FROM public.winner_statuses ws
WHERE ws.slug = w.status::text;

-- Create trigger function to sync status_id when status enum changes
CREATE OR REPLACE FUNCTION public.sync_winner_status_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- If status changed, sync status_id
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT id INTO NEW.status_id
    FROM public.winner_statuses
    WHERE slug = NEW.status::text
    LIMIT 1;
  END IF;
  
  -- If status_id changed (and status didn't), sync status enum
  IF NEW.status_id IS DISTINCT FROM OLD.status_id AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    DECLARE
      new_slug text;
    BEGIN
      SELECT slug INTO new_slug
      FROM public.winner_statuses
      WHERE id = NEW.status_id;
      
      IF new_slug IS NOT NULL THEN
        NEW.status = new_slug::winner_status;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on winners for UPDATE
CREATE TRIGGER trg_sync_winner_status_id
BEFORE UPDATE ON public.winners
FOR EACH ROW
EXECUTE FUNCTION public.sync_winner_status_id();

-- Create trigger function for INSERT to set status_id
CREATE OR REPLACE FUNCTION public.set_winner_status_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status_id IS NULL AND NEW.status IS NOT NULL THEN
    SELECT id INTO NEW.status_id
    FROM public.winner_statuses
    WHERE slug = NEW.status::text
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_winner_status_id_on_insert
BEFORE INSERT ON public.winners
FOR EACH ROW
EXECUTE FUNCTION public.set_winner_status_id_on_insert();

-- Add updated_at trigger for winner_statuses
CREATE TRIGGER trg_winner_statuses_updated_at
BEFORE UPDATE ON public.winner_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
