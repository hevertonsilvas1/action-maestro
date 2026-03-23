-- Permitir importação explícita de ganhadores duplicados quando o operador escolher essa opção.
-- A constraint atual bloqueia qualquer duplicidade em (action_id, prize_type, cpf, prize_datetime, value),
-- o que conflita com a regra funcional do importador.

DROP INDEX IF EXISTS public.idx_winners_dedup;

-- Mantém um índice não único para performance das consultas de deduplicação no app.
CREATE INDEX IF NOT EXISTS idx_winners_dedup_lookup
ON public.winners (action_id, prize_type, cpf, prize_datetime, value)
WHERE cpf IS NOT NULL AND prize_datetime IS NOT NULL;