-- Add transition: numero_inexistente → forcar_pix
INSERT INTO public.winner_status_transitions (from_status_id, to_status_id)
VALUES ('682d0f54-0852-4849-905a-630efba35f6d', 'c023e315-abc5-4b98-a12c-3e8b1d643f81')
ON CONFLICT DO NOTHING;

-- Add time rule: Número Inexistente → Forçar PIX after 48h
INSERT INTO public.status_time_rules (name, from_status, to_status, time_limit, time_unit, is_active, condition_description)
VALUES (
  'Número Inexistente → Forçar PIX (48h)',
  'numero_inexistente',
  'forcar_pix',
  48,
  'hours',
  true,
  'Libera ganhador com número inexistente para lote com dados operacionais (CPF)'
);