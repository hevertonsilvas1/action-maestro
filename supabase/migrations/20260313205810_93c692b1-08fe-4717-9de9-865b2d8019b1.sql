
-- Update time rule to use pix_requested as source status
UPDATE status_time_rules 
SET from_status = 'pix_requested', 
    name = 'Pix Solicitado → Cliente Não Responde (24h)',
    updated_at = now()
WHERE id = 'b6818dd8-4482-477e-b898-8ebb7b170838';

-- Also add transition: pix_requested → cliente_nao_responde (if not exists)
INSERT INTO winner_status_transitions (from_status_id, to_status_id)
SELECT 
  (SELECT id FROM winner_statuses WHERE slug = 'pix_requested'),
  (SELECT id FROM winner_statuses WHERE slug = 'cliente_nao_responde')
WHERE NOT EXISTS (
  SELECT 1 FROM winner_status_transitions 
  WHERE from_status_id = (SELECT id FROM winner_statuses WHERE slug = 'pix_requested')
    AND to_status_id = (SELECT id FROM winner_statuses WHERE slug = 'cliente_nao_responde')
);
