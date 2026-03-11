
INSERT INTO winner_status_transitions (from_status_id, to_status_id)
SELECT fs.id, ts.id
FROM winner_statuses fs, winner_statuses ts
WHERE fs.slug IN ('sent_to_batch', 'pix_received', 'pix_refused')
  AND ts.slug = 'receipt_attached'
ON CONFLICT DO NOTHING;
