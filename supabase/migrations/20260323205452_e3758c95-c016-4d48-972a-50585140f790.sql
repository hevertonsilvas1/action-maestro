
-- Update current counts
UPDATE actions a SET
  winners_count = sub.cnt,
  paid_count = sub.paid,
  pending_count = sub.pending,
  real_paid = sub.total_paid
FROM (
  SELECT
    w.action_id,
    count(*) as cnt,
    count(*) FILTER (WHERE ws.slug IN ('paid','receipt_sent','receipt_attached')) as paid,
    count(*) FILTER (WHERE ws.slug NOT IN ('paid','receipt_sent','receipt_attached')) as pending,
    coalesce(sum(w.value) FILTER (WHERE ws.slug IN ('paid','receipt_sent','receipt_attached')), 0) as total_paid
  FROM winners w
  LEFT JOIN winner_statuses ws ON ws.id = w.status_id
  WHERE w.deleted_at IS NULL
  GROUP BY w.action_id
) sub
WHERE a.id = sub.action_id;

-- Create trigger function to keep counts in sync
CREATE OR REPLACE FUNCTION public.sync_action_winner_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _action_id := OLD.action_id;
  ELSIF TG_OP = 'INSERT' THEN
    _action_id := NEW.action_id;
  ELSE
    _action_id := NEW.action_id;
    IF OLD.action_id IS DISTINCT FROM NEW.action_id THEN
      UPDATE actions SET
        winners_count = (SELECT count(*) FROM winners WHERE action_id = OLD.action_id AND deleted_at IS NULL),
        paid_count = (SELECT count(*) FROM winners w JOIN winner_statuses ws ON ws.id = w.status_id WHERE w.action_id = OLD.action_id AND w.deleted_at IS NULL AND ws.slug IN ('paid','receipt_sent','receipt_attached')),
        pending_count = (SELECT count(*) FROM winners w JOIN winner_statuses ws ON ws.id = w.status_id WHERE w.action_id = OLD.action_id AND w.deleted_at IS NULL AND ws.slug NOT IN ('paid','receipt_sent','receipt_attached')),
        real_paid = coalesce((SELECT sum(w.value) FROM winners w JOIN winner_statuses ws ON ws.id = w.status_id WHERE w.action_id = OLD.action_id AND w.deleted_at IS NULL AND ws.slug IN ('paid','receipt_sent','receipt_attached')), 0)
      WHERE id = OLD.action_id;
    END IF;
  END IF;

  UPDATE actions SET
    winners_count = (SELECT count(*) FROM winners WHERE action_id = _action_id AND deleted_at IS NULL),
    paid_count = (SELECT count(*) FROM winners w JOIN winner_statuses ws ON ws.id = w.status_id WHERE w.action_id = _action_id AND w.deleted_at IS NULL AND ws.slug IN ('paid','receipt_sent','receipt_attached')),
    pending_count = (SELECT count(*) FROM winners w JOIN winner_statuses ws ON ws.id = w.status_id WHERE w.action_id = _action_id AND w.deleted_at IS NULL AND ws.slug NOT IN ('paid','receipt_sent','receipt_attached')),
    real_paid = coalesce((SELECT sum(w.value) FROM winners w JOIN winner_statuses ws ON ws.id = w.status_id WHERE w.action_id = _action_id AND w.deleted_at IS NULL AND ws.slug IN ('paid','receipt_sent','receipt_attached')), 0)
  WHERE id = _action_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_sync_action_winner_counts ON winners;
CREATE TRIGGER trg_sync_action_winner_counts
AFTER INSERT OR UPDATE OR DELETE ON winners
FOR EACH ROW
EXECUTE FUNCTION sync_action_winner_counts();
