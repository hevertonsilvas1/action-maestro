-- Add missing transitions TO sent_to_batch for statuses that are eligible for batch generation
INSERT INTO public.winner_status_transitions (from_status_id, to_status_id)
SELECT fs.id, ts.id
FROM public.winner_statuses fs, public.winner_statuses ts
WHERE ts.slug = 'sent_to_batch'
  AND fs.slug IN ('imported', 'pix_requested', 'awaiting_pix', 'pix_received', 'pix_refused', 'cliente_nao_responde', 'numero_inexistente')
  AND NOT EXISTS (
    SELECT 1 FROM public.winner_status_transitions t
    WHERE t.from_status_id = fs.id AND t.to_status_id = ts.id
  );