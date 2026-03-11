INSERT INTO winner_status_transitions (from_status_id, to_status_id)
SELECT f.id, t.id
FROM winner_statuses f, winner_statuses t
WHERE f.slug = 'pix_requested' AND t.slug = 'pix_received'
AND NOT EXISTS (
  SELECT 1 FROM winner_status_transitions wst
  WHERE wst.from_status_id = f.id AND wst.to_status_id = t.id
);