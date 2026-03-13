
-- Add transitions: cliente_nao_responde → awaiting_pix, forcar_pix → awaiting_pix
INSERT INTO winner_status_transitions (from_status_id, to_status_id)
SELECT 
  (SELECT id FROM winner_statuses WHERE slug = 'cliente_nao_responde'),
  (SELECT id FROM winner_statuses WHERE slug = 'awaiting_pix')
WHERE NOT EXISTS (
  SELECT 1 FROM winner_status_transitions 
  WHERE from_status_id = (SELECT id FROM winner_statuses WHERE slug = 'cliente_nao_responde')
    AND to_status_id = (SELECT id FROM winner_statuses WHERE slug = 'awaiting_pix')
);

INSERT INTO winner_status_transitions (from_status_id, to_status_id)
SELECT 
  (SELECT id FROM winner_statuses WHERE slug = 'forcar_pix'),
  (SELECT id FROM winner_statuses WHERE slug = 'awaiting_pix')
WHERE NOT EXISTS (
  SELECT 1 FROM winner_status_transitions 
  WHERE from_status_id = (SELECT id FROM winner_statuses WHERE slug = 'forcar_pix')
    AND to_status_id = (SELECT id FROM winner_statuses WHERE slug = 'awaiting_pix')
);
