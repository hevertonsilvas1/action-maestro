
-- Clear existing transitions and insert complete workflow
DELETE FROM public.winner_status_transitions;

-- Use a CTE to map slugs to IDs for readability
WITH s AS (
  SELECT id, slug FROM public.winner_statuses
)
INSERT INTO public.winner_status_transitions (from_status_id, to_status_id)
SELECT f.id, t.id
FROM (VALUES
  -- Importado ->
  ('imported', 'pix_requested'),
  ('imported', 'pix_refused'),
  ('imported', 'numero_inexistente'),

  -- Pix Solicitado ->
  ('pix_requested', 'awaiting_pix'),
  ('pix_requested', 'pix_refused'),
  ('pix_requested', 'numero_inexistente'),
  ('pix_requested', 'cliente_nao_responde'),

  -- Aguardando Pix ->
  ('awaiting_pix', 'pix_received'),
  ('awaiting_pix', 'pix_refused'),
  ('awaiting_pix', 'cliente_nao_responde'),

  -- Pix Recebido ->
  ('pix_received', 'ready_to_pay'),
  ('pix_received', 'pix_refused'),

  -- Pronto para Pagar ->
  ('ready_to_pay', 'sent_to_batch'),

  -- Enviado para Lote ->
  ('sent_to_batch', 'awaiting_receipt'),
  ('sent_to_batch', 'paid'),

  -- Aguardando Comprovante ->
  ('awaiting_receipt', 'paid'),

  -- Pago ->
  ('paid', 'receipt_attached'),

  -- Comprovante Anexado ->
  ('receipt_attached', 'receipt_sent'),

  -- Recuperação: status de bloqueio podem voltar ao início
  ('pix_refused', 'imported'),
  ('pix_refused', 'pix_requested'),
  ('numero_inexistente', 'imported'),
  ('numero_inexistente', 'pix_requested'),
  ('cliente_nao_responde', 'imported'),
  ('cliente_nao_responde', 'pix_requested')
) AS transitions(from_slug, to_slug)
JOIN s f ON f.slug = transitions.from_slug
JOIN s t ON t.slug = transitions.to_slug;
