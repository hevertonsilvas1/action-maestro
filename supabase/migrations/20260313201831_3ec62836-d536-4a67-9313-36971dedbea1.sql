-- 1. Add forcar_pix to the winner_status enum
ALTER TYPE public.winner_status ADD VALUE IF NOT EXISTS 'forcar_pix';

-- 2. Insert the new status into winner_statuses table
INSERT INTO public.winner_statuses (name, slug, color, description, sort_order, is_active, is_default, update_mode, trigger_event)
VALUES ('Forçar PIX', 'forcar_pix', '#d97706', 'Ganhador liberado para lote com dados operacionais (CPF/telefone)', 13, true, false, 'automatic', 'force_pix_timeout')
ON CONFLICT DO NOTHING;

-- 3. Add transition: cliente_nao_responde → forcar_pix
INSERT INTO public.winner_status_transitions (from_status_id, to_status_id)
SELECT
  (SELECT id FROM winner_statuses WHERE slug = 'cliente_nao_responde'),
  (SELECT id FROM winner_statuses WHERE slug = 'forcar_pix')
WHERE NOT EXISTS (
  SELECT 1 FROM winner_status_transitions 
  WHERE from_status_id = (SELECT id FROM winner_statuses WHERE slug = 'cliente_nao_responde')
    AND to_status_id = (SELECT id FROM winner_statuses WHERE slug = 'forcar_pix')
);

-- 4. Add transitions from forcar_pix → sent_to_batch, pix_received, imported, awaiting_receipt, receipt_attached
INSERT INTO public.winner_status_transitions (from_status_id, to_status_id)
SELECT 
  (SELECT id FROM winner_statuses WHERE slug = 'forcar_pix'),
  ts.id
FROM winner_statuses ts
WHERE ts.slug IN ('sent_to_batch', 'pix_received', 'imported', 'awaiting_receipt', 'receipt_attached')
ON CONFLICT DO NOTHING;

-- 5. Time rule: awaiting_pix → cliente_nao_responde after 24h
INSERT INTO public.status_time_rules (name, from_status, to_status, time_limit, time_unit, is_active, condition_description)
VALUES ('Aguardando PIX → Cliente Não Responde (24h)', 'awaiting_pix', 'cliente_nao_responde', 24, 'hours', true, 'Aplica-se apenas ao fluxo padrão de solicitação de PIX')
ON CONFLICT DO NOTHING;

-- 6. Time rule: cliente_nao_responde → forcar_pix after 48h
INSERT INTO public.status_time_rules (name, from_status, to_status, time_limit, time_unit, is_active, condition_description)
VALUES ('Cliente Não Responde → Forçar PIX (48h)', 'cliente_nao_responde', 'forcar_pix', 48, 'hours', true, 'Libera ganhador para lote com dados operacionais (CPF/telefone)')
ON CONFLICT DO NOTHING;

-- 7. Create version for forcar_pix status
INSERT INTO public.winner_status_versions (status_id, version, is_active, update_mode, trigger_event)
SELECT id, 1, true, 'automatic', 'force_pix_timeout'
FROM winner_statuses WHERE slug = 'forcar_pix';